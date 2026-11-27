-- Captions that look like they contain a "message to send" for registration. READ ONLY, output goes to private/.
BEGIN READ ONLY; SET LOCAL statement_timeout='60s';
SELECT row_to_json(t) FROM (
  SELECT p.id AS post_id, p.platform_post_id, p.published_at, length(p.content) AS len, p.content AS caption
  FROM posts p
  WHERE p.content IS NOT NULL
    AND EXISTS (SELECT 1 FROM event_posts ep JOIN events e ON e.id = ep.event_id WHERE ep.post_id = p.id AND e.deleted_at IS NULL AND e.merged_into_event_id IS NULL)
    AND ( p.content ~* '(format|ketik|kirim(kan)? (pesan|chat)|chat (dengan|dg|dgn) format|pesan (pendaftaran|dengan format)|daftar#|reg#|reg (nama|<)|isi data|template)[^\n]{0,80}'
       OR p.content ~* '(nama|name)[ ]*[:/-][^\n]{0,60}\n[^\n]{0,10}(umur|usia|kelas|asal|kategori|instansi|alamat|domisili|no\.? ?(hp|wa|telp))' )
    AND p.content ~* '(wa|whatsapp|0?8[0-9]{2}|\+62|chat|pesan)'
  ORDER BY md5(p.id::text)
  LIMIT 40
) t;
ROLLBACK;
