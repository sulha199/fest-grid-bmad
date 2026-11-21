"""POC reference decoder: OpenCV QR detectors on the same images (a ceiling for the Node libraries, and a "box found" signal for
codes that no decoder could read). Not a deployment candidate: OpenCV is not in our Node Lambdas.
Run:  python -I qr-opencv.py     (needs opencv-python-headless; pass its folder in OPENCV_LIB)
Output: private/qr-opencv.jsonl (gitignored: holds decoded text)."""
import json, os, sys, time
sys.path.insert(0, os.environ.get('OPENCV_LIB', ''))
import cv2

manifest = json.load(open('private/img-manifest.json', encoding='utf-8'))
OUT = 'private/qr-opencv.jsonl'
done = set()
if os.path.exists(OUT):
    for line in open(OUT, encoding='utf-8'):
        done.add(json.loads(line)['file'])
classic = cv2.QRCodeDetector()
aruco = cv2.QRCodeDetectorAruco()


def fit(img, cap):
    h, w = img.shape[:2]
    s = cap / max(h, w)
    return cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA) if s < 1 else img


with open(OUT, 'a', encoding='utf-8') as out:
    for m in manifest:
        if m['file'] in done:
            continue
        img = cv2.imread(m['file'])
        if img is None:
            out.write(json.dumps({'file': m['file'], 'error': 'read'}) + '\n')
            continue
        img = fit(img, 2000)
        t = time.time()
        texts, box = [], False
        # 1) aruco-based multi detector (OpenCV 5)
        try:
            ok, dec, pts, _ = aruco.detectAndDecodeMulti(img)
            box = box or (pts is not None and len(pts) > 0)
            texts += [d for d in (dec or []) if d]
        except Exception:
            pass
        # 2) classic detector, full size
        if not texts:
            v, pts, _ = classic.detectAndDecode(img)
            box = box or pts is not None
            if v:
                texts.append(v)
        # 3) classic detector on halves/tiles, 2x upscale (small codes)
        if not texts:
            h, w = img.shape[:2]
            for (y0, y1, x0, x1) in [(0, h // 2, 0, w), (h // 2, h, 0, w), (0, h, 0, w // 2), (0, h, w // 2, w), (h // 2, h, w // 2, w), (h // 2, h, 0, w // 2)]:
                crop = img[y0:y1, x0:x1]
                crop = cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
                v, pts, _ = classic.detectAndDecode(crop)
                box = box or pts is not None
                if v:
                    texts.append(v)
                    break
        out.write(json.dumps({'file': m['file'], 'pid': m['pid'], 'i': m['i'], 'ms': int((time.time() - t) * 1000), 'texts': texts, 'box': bool(box)}) + '\n')
        out.flush()
print('done')
