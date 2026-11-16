import sys
# usage: resolve.py file choice1 choice2 ...   choice in ours|theirs|both|bothr (theirs then ours)
f=sys.argv[1]; ch=sys.argv[2:]
t=open(f,encoding='utf-8',newline='').read().split('\n')
out=[];i=0;n=0
while i<len(t):
    if t[i].startswith('<<<<<<<'):
        a=[];b=[];i+=1
        while not t[i].startswith('======='): a.append(t[i]);i+=1
        i+=1
        while not t[i].startswith('>>>>>>>'): b.append(t[i]);i+=1
        c=ch[n];n+=1
        out+= {'ours':a,'theirs':b,'both':a+b,'bothr':b+a}[c]
    else: out.append(t[i])
    i+=1
assert n==len(ch),(n,len(ch))
open(f,'w',encoding='utf-8',newline='').write('\n'.join(out))
print(f,'resolved',n)
