import crypto from 'crypto';

async function decryptAES_GCM(e: string, keyDecrypt: string): Promise<ArrayBuffer> {
  function w(str: string): Uint8Array {
    const t = Buffer.from(str, 'base64').toString('binary');
    const a = t.length;
    const n = new Uint8Array(a);
    for (let s = 0; s < a; s++) {
      n[s] = t.charCodeAt(s);
    }
    return n;
  }
  const t = w(decodeURIComponent(e));
  if (t && t.length >= 48) {
    const key = t.slice(0, 16);
    const iv = t.slice(16, 32);
    const ciphertext = t.slice(32);

    const algorithm = {
      name: 'AES-GCM',
      iv: key,
      tagLength: 128 as const,
      additionalData: iv,
    };

    const importedKey = await crypto.subtle.importKey('raw', w(keyDecrypt) as unknown as ArrayBuffer, algorithm, false, ['decrypt']);
    const decryptedData = await crypto.subtle.decrypt(algorithm, importedKey, ciphertext);
    return decryptedData;
  } else {
    throw new Error('decrypt error: invalid cipher');
  }
}

class Kt {
  options: any;
  err: number = 0;
  msg: string = '';
  ended: boolean = false;
  chunks: Uint8Array[] = [];
  strm: any;
  header: any;
  result: Uint8Array | null = null;
  wt = -2;
  qt = -2;
  vt = 0;
  xt = -3;
  Gt = -3;
  kt = -4;
  Zt = -4;
  St = -5;
  Ht = 4;
  Bt = 0;
  Ut = 0;
  Wt = 1;
  Vt = 2;
  bt = 2;
  Tt = 12;
  Et = 30;
  mt = 4;
  Mt = 8;
  gt = 5;
  yt = 6;
  ut = 15;
  _t = 1;

  Lt = (e: number) =>
    ((e >>> 24) & 255) +
    ((e >>> 8) & 65280) +
    ((65280 & e) << 8) +
    ((255 & e) << 24);

  ct = new Uint16Array([3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0]);
  dt = new Uint8Array([16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,72,78]);
  ht = new Uint16Array([1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0]);
  ft = new Uint8Array([16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64]);

  U: Record<string, string> = {
    '2': 'need dictionary',
    '1': 'stream end',
    '0': '',
    '-1': 'file error',
    '-2': 'stream error',
    '-3': 'data error',
    '-4': 'insufficient memory',
    '-5': 'buffer error',
    '-6': 'incompatible version',
  };

  Ft = (e: any, t: any, n: any, r: any) => {
    let i;
    const a = e.state;
    return (
      null === a.window &&
        ((a.wsize = 1 << a.wbits), (a.wnext = 0), (a.whave = 0), (a.window = new Uint8Array(a.wsize))),
      r >= a.wsize
        ? (a.window.set(t.subarray(n - a.wsize, n), 0), (a.wnext = 0), (a.whave = a.wsize))
        : ((i = a.wsize - a.wnext),
          i > r && (i = r),
          a.window.set(t.subarray(n - r, n - r + i), a.wnext),
          (r -= i)
            ? (a.window.set(t.subarray(n - r, n), 0), (a.wnext = r), (a.whave = a.wsize))
            : ((a.wnext += i), a.wnext === a.wsize && (a.wnext = 0), a.whave < a.wsize && (a.whave += i))),
      0
    );
  };

  $ = (e: number, t: any, n: number, r: number) => {
    let i = (65535 & e) | 0,
      a = ((e >>> 16) & 65535) | 0,
      o = 0;
    for (; 0 !== n; ) {
      (o = n > 2e3 ? 2e3 : n), (n -= o);
      do { (i = (i + t[r++]) | 0), (a = (a + i) | 0); } while (--o);
      (i %= 65521), (a %= 65521);
    }
    return i | (a << 16) | 0;
  };

  $t = Object.prototype.toString;

  inflateSetDictionary = (e: any, t: any) => {
    const n = t.length;
    let r: any, i: any, a: any;
    return e && e.state
      ? ((r = e.state),
        0 !== r.wrap && 11 !== r.mode
          ? this.wt
          : 11 === r.mode && ((i = 1), (i = this.$(i, t, n, 0)), i !== r.check)
            ? this.xt
            : ((a = this.Ft(e, t, n, n)), a ? ((r.mode = 31), this.kt) : ((r.havedict = 1), this.vt)))
      : this.wt;
  };

  inflateReset = (n: any) => n;
  Ve = (_output: any, _e: any) => { return undefined; };
  qe = (output: any, next_out: any) => output - next_out;
  jt = (_n: any) => {};

  push = (e: any, t: any) => {
    const n = this.strm;
    const r = this.options.chunkSize;
    const i = this.options.dictionary;
    let a: any, o: any, s: any;
    if (this.ended) return false;

    for (
      o = t === ~~t ? t : true === t ? this.Ht : this.Bt,
        '[object ArrayBuffer]' === this.$t.call(e) ? (n.input = new Uint8Array(e)) : (n.input = e),
        n.next_in = 0,
        n.avail_in = n.input.length;
      ;
    ) {
      if (0 === n.avail_out) {
        n.output = new Uint8Array(r);
        n.next_out = 0;
        n.avail_out = r;
      }
      a = this.inflate(n, o);
      if (a === this.Vt && i) {
        a = this.inflateSetDictionary(n, i);
        if (a === this.Ut) {
          a = this.inflate(n, o);
        } else if (a === this.Gt) {
          a = this.Vt;
        }
      }
      while (n.avail_in > 0 && a === this.Wt && n.state.wrap > 0 && e[n.next_in] !== 0) {
        this.inflateReset(n);
        a = this.inflate(n, o);
      }
      switch (a) {
        case this.qt:
        case this.Gt:
        case this.Vt:
        case this.Zt:
          this.onEnd(a);
          this.ended = true;
          return false;
      }
      s = n.avail_out;
      if (n.next_out && (0 === n.avail_out || a === this.Wt)) {
        if ('string' === this.options.to) {
          const e = this.qe(n.output, n.next_out);
          const t = n.next_out - e;
          const i = this.Ve(n.output, e);
          n.next_out = t;
          n.avail_out = r - t;
          if (t) { n.output.set(n.output.subarray(e, e + t), 0); }
          this.onData(i);
        } else {
          this.onData(n.output.length === n.next_out ? n.output : n.output.subarray(0, n.next_out));
        }
      }
      if (a !== this.Ut || 0 !== s) {
        if (a === this.Wt) {
          a = this.inflateEnd(this.strm);
          this.onEnd(a);
          this.ended = true;
          return true;
        }
        if (0 === n.avail_in) break;
      }
    }
    return !0;
  };

  onEnd = (e: any) => {
    this.result = this.Be(this.chunks);
    this.chunks = [];
    this.err = e;
    this.msg = this.strm.msg;
  };

  Be = (e: any[]) => {
    let t = 0;
    for (let r = 0, i = e.length; r < i; r++) t += e[r].length;
    const n = new Uint8Array(t);
    for (let r = 0, i = 0, a = e.length; r < a; r++) {
      const t = e[r];
      n.set(t, i);
      i += t.length;
    }
    return n;
  };

  onData = (e: any) => { this.chunks.push(e); };

  inflateEnd = (e: any) => {
    if (!e || !e.state) return this.wt;
    const t = e.state;
    return t.window && (t.window = null), (e.state = null), this.vt;
  };

  constructor(e?: any) {
    this.options = Object.assign({ chunkSize: 65536, windowBits: 15, to: '' }, e || {});
    const t = { ...this.options, ...(e || {}) };
    if (t.raw && t.windowBits >= 0 && t.windowBits < 16) {
      t.windowBits = -t.windowBits;
      if (t.windowBits === 0) t.windowBits = -15;
    }
    if (t.windowBits >= 0 && t.windowBits < 16) t.windowBits += 32;
    if (t.windowBits > 15 && t.windowBits < 48 && (15 & t.windowBits) === 0) t.windowBits |= 15;

    this.err = 0;
    this.msg = '';
    this.ended = false;
    this.chunks = [];
    this.strm = {
      input: null, next_in: 0, avail_in: 0, total_in: 0,
      output: null, next_out: 0, avail_out: 0, total_out: 0,
      msg: '', state: null, data_type: 2, adler: 0,
    };
    this.strm.avail_out = 0;

    const inflateInit2 = (e: any, t: any) => {
      if (!e) return this.wt;
      const n: any = {
        mode: 0, last: false, wrap: 0, havedict: false, flags: 0, dmax: 0, check: 0, total: 0,
        head: null, wbits: 0, wsize: 0, whave: 0, wnext: 0, window: null, hold: 0, bits: 0,
        length: 0, offset: 0, extra: 0, lencode: null, distcode: null, lenbits: 0, distbits: 0,
        ncode: 0, nlen: 0, ndist: 0, have: 0, next: null,
        lens: new Uint16Array(320), work: new Uint16Array(288),
        lendyn: null, distdyn: null, sane: 0, back: 0, was: 0,
      };
      e.state = n;
      this.strm.state = n;
      n.window = null;

      const Ot = (e: any, t: any) => {
        const Dt = (e: any) => {
          if (!e || !e.state) return this.wt;
          const t = e.state;
          const At = (e: any) => {
            if (!e || !e.state) return this.wt;
            const t = e.state;
            e.total_in = e.total_out = t.total = 0;
            e.msg = '';
            if (t.wrap) e.adler = 1 & t.wrap;
            t.mode = 1; t.last = 0; t.havedict = 0; t.dmax = 32768; t.head = null;
            t.hold = 0; t.bits = 0;
            t.lencode = t.lendyn = new Int32Array(852);
            t.distcode = t.distdyn = new Int32Array(592);
            t.sane = 1; t.back = -1;
            return this.vt;
          };
          t.wsize = 0; t.whave = 0; t.wnext = 0;
          return At(e);
        };
        let n: any;
        if (!e || !e.state) return this.wt;
        const r = e.state;
        if (t < 0) { n = 0; t = -t; }
        else { n = Math.floor(t / 16) + 1; if (t < 48) t &= 15; }
        if (t && (t < 8 || t > 15)) return this.wt;
        if (null !== r.window && r.wbits !== t) r.window = null;
        r.wrap = n; r.wbits = t;
        return Dt(e);
      };
      const r = Ot(e, t);
      return r !== this.vt && (e.state = null), r;
    };

    let n = inflateInit2(this.strm, t.windowBits);
    if (n !== this.Ut) throw new Error(this.U[String(n)]);

    this.header = { text: 0, time: 0, xflags: 0, os: 0, extra: null, extra_len: 0, name: '', comment: '', hcrc: 0, done: false };

    const inflateGetHeader = (e: any, t: any) => {
      if (!e || !e.state) return -2;
      const n = e.state;
      return 0 == (2 & n.wrap) ? 2 : ((n.head = t), (t.done = false), 0);
    };

    inflateGetHeader(this.strm, this.header);

    const We = (e: string) => {
      let t: Uint8Array, n: number, r: number, i: number, a: number, s = 0;
      const o = e.length;
      for (i = 0; i < o; i++)
        (n = e.charCodeAt(i)),
          55296 == (64512 & n) && i + 1 < o && ((r = e.charCodeAt(i + 1)), 56320 == (64512 & r) && ((n = 65536 + ((n - 55296) << 10) + (r - 56320)), i++)),
          (s += n < 128 ? 1 : n < 2048 ? 2 : n < 65536 ? 3 : 4);
      for (t = new Uint8Array(s), a = 0, i = 0; a < s; i++)
        (n = e.charCodeAt(i)),
          55296 == (64512 & n) && i + 1 < o && ((r = e.charCodeAt(i + 1)), 56320 == (64512 & r) && ((n = 65536 + ((n - 55296) << 10) + (r - 56320)), i++)),
          n < 128 ? (t[a++] = n)
          : n < 2048 ? ((t[a++] = 192 | (n >>> 6)), (t[a++] = 128 | (63 & n)))
          : n < 65536 ? ((t[a++] = 224 | (n >>> 12)), (t[a++] = 128 | ((n >>> 6) & 63)), (t[a++] = 128 | (63 & n)))
          : ((t[a++] = 240 | (n >>> 18)), (t[a++] = 128 | ((n >>> 12) & 63)), (t[a++] = 128 | ((n >>> 6) & 63)), (t[a++] = 128 | (63 & n)));
      return t;
    };

    if (t.dictionary) {
      if (typeof t.dictionary === 'string') t.dictionary = We(t.dictionary);
      else if (Object.prototype.toString.call(t.dictionary) === '[object ArrayBuffer]') t.dictionary = new Uint8Array(t.dictionary);
      if (t.raw) {
        n = this.inflateSetDictionary(this.strm, t.dictionary);
        if (n !== 0) throw new Error(this.U[String(n)]);
      }
    }
  }

  inflate = (e: any, t: any): any => {
    let r: any, i: any, a: any, o: any, s: any, l: any, u: any, c: any, d: any, h: any, f: any, p: any, m: any, g: any, y: any, v: any, _: any, b: any, w: any, x: any, k: any;
    let S = 0;
    const M = new Uint8Array(4);
    let T: any, E: any;
    const L = new Uint8Array([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]);

    if (!e || !e.state || !e.output || (!e.input && e.avail_in !== 0)) return this.wt;

    const n = e.state;
    if (n.mode === this.Tt) n.mode = 13;

    o = e.next_out; i = e.output; l = e.avail_out; a = e.next_in; r = e.input; s = e.avail_in;
    u = n.hold; c = n.bits; d = s; h = l; k = this.vt;

    const H = (e: any, t: any, n: any, r: any) => {
      const B = new Uint32Array((() => {
        let e: any; const t: number[] = [];
        for (let n = 0; n < 256; n++) {
          e = n;
          for (let r = 0; r < 8; r++) e = 1 & e ? 3988292384 ^ (e >>> 1) : e >>> 1;
          t[n] = e;
        }
        return t;
      })());
      const i = B; const aa = r + n; e ^= -1;
      for (let o = r; o < aa; o++) e = (e >>> 8) ^ i[255 & (e ^ t[o])];
      return -1 ^ e;
    };

    const pt = (e: any, t: any, n: any, r: any, i: any, a: any, o: any, s: any) => {
      const l = s.bits;
      let u: any, c: any, d: any, f: any, p: any, m=0,g=0,y=0,v=0,_=0,b=0,w=0,x=0,k=0,S=0,M: any=null,T=0;
      const E = new Uint16Array(16), L = new Uint16Array(16);
      let C: any, A: any, D: any, O: any=null, P=0;
      for (m=0; m<=this.ut; m++) E[m]=0;
      for (g=0; g<r; g++) E[t[n+g]]++;
      for (_=l, v=this.ut; v>=1&&0===E[v]; v--);
      if ((_>v&&(_=v), 0===v)) { i[a++]=20971520; i[a++]=20971520; s.bits=1; return 0; }
      for (y=1; y<v&&0===E[y]; y++);
      if (_<y) _=y;
      x=1;
      for (m=1; m<=this.ut; m++) { x<<=1; x-=E[m]; if (x<0) return -1; }
      if (x>0&&(0===e||1!==v)) return -1;
      for (L[1]=0, m=1; m<this.ut; m++) L[m+1]=L[m]+E[m];
      for (g=0; g<r; g++) { if (0!==t[n+g]) o[L[t[n+g]]++]=g; }
      if (0===e) { M=O=o; p=19; }
      else if (1===e) { M=this.ct; T-=257; O=this.dt; P-=257; p=256; }
      else { M=this.ht; O=this.ft; p=-1; }
      S=0; g=0; m=y; f=a; b=_; w=0; d=-1; k=1<<_;
      const h2=k-1;
      if ((1===e&&k>852)||(2===e&&k>592)) return 1;
      for (;;) {
        C=m-w;
        o[g]<p?((A=0),(D=o[g])):o[g]>p?((A=O[P+o[g]]),(D=M[T+o[g]])):((A=96),(D=0));
        u=1<<(m-w); c=1<<b; y=c;
        do { c-=u; i[f+(S>>w)+c]=(C<<24)|(A<<16)|D|0; } while (0!==c);
        for (u=1<<(m-1); S&u;) u>>=1;
        if (0!==u) { S&=u-1; S+=u; } else S=0;
        g++;
        if (0==--E[m]) { if (m===v) break; m=t[n+o[g]]; }
        if (m>_&&(S&h2)!==d) {
          for (0===w&&(w=_), f+=y, b=m-w, x=1<<b; b+w<v&&((x-=E[b+w]),!(x<=0));) b++, (x<<=1);
          if (((k+=1<<b),(1===e&&k>852)||(2===e&&k>592))) return 1;
          d=S&h2; i[d]=(_<<24)|(b<<16)|(f-a)|0;
        }
      }
      if (0!==S) i[f+S]=((m-w)<<24)|(64<<16)|0;
      s.bits=_; return 0;
    };

    e: for (;;) switch (n.mode) {
      case 1:
        if (0===n.wrap) { n.mode=13; break; }
        for (;c<16;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
        if ((n.wrap&2)!==0&&u===35615) {
          n.check=0; M[0]=255&u; M[1]=(u>>>8)&255; n.check=H(n.check,M,2,0); u=0; c=0; n.mode=2; break;
        }
        if ((n.flags=0), n.head&&(n.head.done=false), !(1&n.wrap)||(((255&u)<<8)+(u>>8))%31) { e.msg='incorrect header check'; n.mode=this.Et; break; }
        if ((15&u)!==this.Mt) { e.msg='unknown compression method'; n.mode=this.Et; break; }
        if (((u>>>=4),(c-=4),(x=8+(15&u)),0===n.wbits)) n.wbits=x;
        else if (x>n.wbits) { e.msg='invalid window size'; n.mode=this.Et; break; }
        n.dmax=1<<n.wbits; e.adler=n.check=1; n.mode=512&u?10:this.Tt; u=0; c=0; break;
      case 2:
        for (;c<16;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
        if (((n.flags=u),(255&n.flags)!==this.Mt)) { e.msg='unknown compression method'; n.mode=this.Et; break; }
        if (57344&n.flags) { e.msg='unknown header flags set'; n.mode=this.Et; break; }
        n.head&&(n.head.text=(u>>8)&1);
        if (512&n.flags) { M[0]=255&u; M[1]=(u>>>8)&255; n.check=H(n.check,M,2,0); }
        u=0; c=0; n.mode=3; break;
      case 3:
        for (;c<32;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
        n.head&&(n.head.time=u), 512&n.flags&&((M[0]=255&u),(M[1]=(u>>>8)&255),(M[2]=(u>>>16)&255),(M[3]=(u>>>24)&255),(n.check=H(n.check,M,4,0))), (u=0),(c=0),(n.mode=4);
      case 4:
        for (;c<16;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
        n.head&&((n.head.xflags=255&u),(n.head.os=u>>8)), 512&n.flags&&((M[0]=255&u),(M[1]=(u>>>8)&255),(n.check=H(n.check,M,2,0))), (u=0),(c=0),(n.mode=5);
      case 5:
        if (1024&n.flags) {
          for (;c<16;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
          (n.length=u), n.head&&(n.head.extra_len=u), 512&n.flags&&((M[0]=255&u),(M[1]=(u>>>8)&255),(n.check=H(n.check,M,2,0))), (u=0),(c=0);
        } else n.head&&(n.head.extra=null);
        n.mode=6;
      case 6:
        if (1024&n.flags&&((f=n.length),f>s&&(f=s),f&&(n.head&&((x=n.head.extra_len-n.length),n.head.extra||(n.head.extra=new Uint8Array(n.head.extra_len)),n.head.extra.set(r.subarray(a,a+f),x)),512&n.flags&&(n.check=H(n.check,r,f,a)),(s-=f),(a+=f),(n.length-=f)),n.length)) break e;
        (n.length=0),(n.mode=7);
      case 7:
        if (2048&n.flags) {
          if (0===s) break e; f=0;
          do { (x=r[a+f++]),n.head&&x&&n.length<65536&&(n.head.name+=String.fromCharCode(x)); } while (x&&f<s);
          if ((512&n.flags&&(n.check=H(n.check,r,f,a)),(s-=f),(a+=f),x)) break e;
        } else n.head&&(n.head.name=null);
        (n.length=0),(n.mode=8);
      case 8:
        if (4096&n.flags) {
          if (0===s) break e; f=0;
          do { (x=r[a+f++]),n.head&&x&&n.length<65536&&(n.head.comment+=String.fromCharCode(x)); } while (x&&f<s);
          if ((512&n.flags&&(n.check=H(n.check,r,f,a)),(s-=f),(a+=f),x)) break e;
        } else n.head&&(n.head.comment=null);
        n.mode=9;
      case 9:
        if (512&n.flags) {
          for (;c<16;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
          if (u!==(65535&n.check)) { (e.msg='header crc mismatch'),(n.mode=this.Et); break; }
          (u=0),(c=0);
        }
        n.head&&((n.head.hcrc=(n.flags>>9)&1),(n.head.done=true)), (e.adler=n.check=0),(n.mode=this.Tt); break;
      case 10:
        for (;c<32;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
        (e.adler=n.check=this.Lt(u)),(u=0),(c=0),(n.mode=11);
      case 11:
        if (0===n.havedict) return (e.next_out=o),(e.avail_out=l),(e.next_in=a),(e.avail_in=s),(n.hold=u),(n.bits=c),this.bt;
        (e.adler=n.check=1),(n.mode=this.Tt);
      case 12:
        if (t===this.gt||t===this.yt) break e;
      case 13:
        if (n.last) { (u>>>=7&c),(c-=7&c),(n.mode=27); break; }
        for (;c<3;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
        switch ((n.last=1&u),(u>>>=1),(c-=1),3&u) {
          case 0: n.mode=14; break;
          case 1: if ((this.jt(n),(n.mode=20),t===this.yt)) { (u>>>=2),(c-=2); break e; } break;
          case 2: n.mode=17; break;
          case 3: (e.msg='invalid block type'),(n.mode=this.Et);
        }
        (u>>>=2),(c-=2); break;
      case 14:
        for (u>>>=7&c,c-=7&c;c<32;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
        if ((65535&u)!=((u>>>16)^65535)) { (e.msg='invalid stored block lengths'),(n.mode=this.Et); break; }
        if (((n.length=65535&u),(u=0),(c=0),(n.mode=15),t===this.yt)) break e;
      case 15: n.mode=16;
      case 16:
        if (((f=n.length),f)) {
          if ((f>s&&(f=s),f>l&&(f=l),0===f)) break e;
          i.set(r.subarray(a,a+f),o),(s-=f),(a+=f),(l-=f),(o+=f),(n.length-=f); break;
        }
        n.mode=this.Tt; break;
      case 17:
        for (;c<14;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
        if (((n.nlen=257+(31&u)),(u>>>=5),(c-=5),(n.ndist=1+(31&u)),(u>>>=5),(c-=5),(n.ncode=4+(15&u)),(u>>>=4),(c-=4),n.nlen>286||n.ndist>30)) { (e.msg='too many length or distance symbols'),(n.mode=this.Et); break; }
        (n.have=0),(n.mode=18);
      case 18:
        for (;n.have<n.ncode;) { for (;c<3;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); } (n.lens[L[n.have++]]=7&u),(u>>>=3),(c-=3); }
        for (;n.have<19;) n.lens[L[n.have++]]=0;
        if (((n.lencode=n.lendyn),(n.lenbits=7),(T={bits:n.lenbits}),(k=pt(0,n.lens,0,19,n.lencode,0,n.work,T)),(n.lenbits=T.bits),k)) { (e.msg='invalid code lengths set'),(n.mode=this.Et); break; }
        (n.have=0),(n.mode=19);
      case 19:
        for (;n.have<n.nlen+n.ndist;) {
          for (;(S=n.lencode[u&((1<<n.lenbits)-1)]),(g=S>>>24),(y=(S>>>16)&255),(v=65535&S),!(g<=c);) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
          if (v<16) (u>>>=g),(c-=g),(n.lens[n.have++]=v);
          else {
            if (16===v) {
              for (E=g+2;c<E;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
              if (((u>>>=g),(c-=g),0===n.have)) { (e.msg='invalid bit length repeat'),(n.mode=this.Et); break; }
              (x=n.lens[n.have-1]),(f=3+(3&u)),(u>>>=2),(c-=2);
            } else if (17===v) {
              for (E=g+3;c<E;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
              (u>>>=g),(c-=g),(x=0),(f=3+(7&u)),(u>>>=3),(c-=3);
            } else {
              for (E=g+7;c<E;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
              (u>>>=g),(c-=g),(x=0),(f=11+(127&u)),(u>>>=7),(c-=7);
            }
            if (n.have+f>n.nlen+n.ndist) { (e.msg='invalid bit length repeat'),(n.mode=this.Et); break; }
            for (;f--;) n.lens[n.have++]=x;
          }
        }
        if (n.mode===this.Et) break;
        if (0===n.lens[256]) { (e.msg='invalid code -- missing end-of-block'),(n.mode=this.Et); break; }
        if (((n.lenbits=9),(T={bits:n.lenbits}),(k=pt(1,n.lens,0,n.nlen,n.lencode,0,n.work,T)),(n.lenbits=T.bits),k)) { (e.msg='invalid literal/lengths set'),(n.mode=this.Et); break; }
        if (((n.distbits=6),(n.distcode=n.distdyn),(T={bits:n.distbits}),(k=pt(2,n.lens,n.nlen,n.ndist,n.distcode,0,n.work,T)),(n.distbits=T.bits),k)) { (e.msg='invalid distances set'),(n.mode=this.Et); break; }
        if (((n.mode=20),t===this.yt)) break e;
      case 20: n.mode=21;
      case 21:
        if (s>=6&&l>=258) {
          (e.next_out=o),(e.avail_out=l),(e.next_in=a),(e.avail_in=s),(n.hold=u),(n.bits=c),
          this.lt(e,h),(o=e.next_out),(i=e.output),(l=e.avail_out),(a=e.next_in),(r=e.input),(s=e.avail_in),(u=n.hold),(c=n.bits),
          n.mode===this.Tt&&(n.back=-1); break;
        }
        for (n.back=0;(S=n.lencode[u&((1<<n.lenbits)-1)]),(g=S>>>24),(y=(S>>>16)&255),(v=65535&S),!(g<=c);) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
        if (y&&0==(240&y)) {
          for (_=g,b=y,w=v;(S=n.lencode[w+((u&((1<<(_+b))-1))>>_)]),(g=S>>>24),(y=(S>>>16)&255),(v=65535&S),!(_+g<=c);) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
          (u>>>=_),(c-=_),(n.back+=_);
        }
        if (((u>>>=g),(c-=g),(n.back+=g),(n.length=v),0===y)) { n.mode=26; break; }
        if (32&y) { (n.back=-1),(n.mode=this.Tt); break; }
        if (64&y) { (e.msg='invalid literal/length code'),(n.mode=this.Et); break; }
        (n.extra=15&y),(n.mode=22);
      case 22:
        if (n.extra) {
          for (E=n.extra;c<E;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
          (n.length+=u&((1<<n.extra)-1)),(u>>>=n.extra),(c-=n.extra),(n.back+=n.extra);
        }
        (n.was=n.length),(n.mode=23);
      case 23:
        for (;(S=n.distcode[u&((1<<n.distbits)-1)]),(g=S>>>24),(y=(S>>>16)&255),(v=65535&S),!(g<=c);) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
        if (0==(240&y)) {
          for (_=g,b=y,w=v;(S=n.distcode[w+((u&((1<<(_+b))-1))>>_)]),(g=S>>>24),(y=(S>>>16)&255),(v=65535&S),!(_+g<=c);) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
          (u>>>=_),(c-=_),(n.back+=_);
        }
        if (((u>>>=g),(c-=g),(n.back+=g),64&y)) { (e.msg='invalid distance code'),(n.mode=this.Et); break; }
        (n.offset=v),(n.extra=15&y),(n.mode=24);
      case 24:
        if (n.extra) {
          for (E=n.extra;c<E;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
          (n.offset+=u&((1<<n.extra)-1)),(u>>>=n.extra),(c-=n.extra),(n.back+=n.extra);
        }
        if (n.offset>n.dmax) { (e.msg='invalid distance too far back'),(n.mode=this.Et); break; }
        n.mode=25;
      case 25:
        if (0===l) break e;
        if (((f=h-l),n.offset>f)) {
          if (((f=n.offset-f),f>n.whave&&n.sane)) { (e.msg='invalid distance too far back'),(n.mode=this.Et); break; }
          f>n.wnext?((f-=n.wnext),(p=n.wsize-f)):(p=n.wnext-f),
          f>n.length&&(f=n.length),(m=n.window);
        } else (m=i),(p=o-n.offset),(f=n.length);
        f>l&&(f=l),(l-=f),(n.length-=f);
        do { i[o++]=m[p++]; } while (--f);
        0===n.length&&(n.mode=21); break;
      case 26:
        if (0===l) break e;
        (i[o++]=n.length),l--,(n.mode=21); break;
      case 27:
        if (n.wrap) {
          for (;c<32;) { if (0===s) break e; s--,(u|=r[a++]<<c),(c+=8); }
          if (((h-=l),(e.total_out+=h),(n.total+=h),h&&(e.adler=n.check=n.flags?H(n.check,i,h,o-h):this.$(n.check,i,h,o-h)),(h=l),(n.flags?u:this.Lt(u))!==n.check)) { (e.msg='incorrect data check'),(n.mode=this.Et); break; }
          (u=0),(c=0);
        }
        n.mode=28;
      case 28:
        if (n.wrap&&n.flags) {
          for (;c<32;) { if (0===s) break e; s--,(u+=r[a++]<<c),(c+=8); }
          if (u!==(4294967295&n.total)) { (e.msg='incorrect length check'),(n.mode=this.Et); break; }
          (u=0),(c=0);
        }
        n.mode=29;
      case 29: k=this._t; break e;
      case 30: k=this.xt; break e;
      case 31: return this.kt;
      default: return this.wt;
    }

    return (
      (e.next_out=o),(e.avail_out=l),(e.next_in=a),(e.avail_in=s),(n.hold=u),(n.bits=c),
      (n.wsize||(h!==e.avail_out&&n.mode<this.Et&&(n.mode<27||t!==this.mt)))&&this.Ft(e,e.output,e.next_out,h-e.avail_out),
      (d-=e.avail_in),(h-=e.avail_out),(e.total_in+=d),(e.total_out+=h),(n.total+=h),
      n.wrap&&h&&(e.adler=n.check=n.flags?H(n.check,i,h,e.next_out-h):this.$(n.check,i,h,e.next_out-h)),
      (e.data_type=n.bits+(n.last?64:0)+(n.mode===this.Tt?128:0)+(20===n.mode||15===n.mode?256:0)),
      ((0===d&&0===h)||t===this.mt)&&k===this.vt&&(k=this.St),
      k
    );
  };

  lt = (e: any, t: any) => {
    let n: any,r: any,i: any,a: any,o: any,s: any,l: any,u: any,c: any,d: any,h: any,f: any,p: any,m: any,g: any,y: any,v: any,_: any,b: any,w: any,x: any,k: any,S: any,M: any;
    const T = e.state;
    (n=e.next_in),(S=e.input),(r=n+(e.avail_in-5)),(i=e.next_out),(M=e.output),(a=i-(t-e.avail_out)),(o=i+(e.avail_out-257)),
    (s=T.dmax),(l=T.wsize),(u=T.whave),(c=T.wnext),(d=T.window),(h=T.hold),(f=T.bits),(p=T.lencode),(m=T.distcode),
    (g=(1<<T.lenbits)-1),(y=(1<<T.distbits)-1);
    e: do {
      f<15&&((h+=S[n++]<<f),(f+=8),(h+=S[n++]<<f),(f+=8)),(v=p[h&g]);
      t: for (;;) {
        if ((_=v>>>24),(h>>>=_),(f-=_),(_=(v>>>16)&255),0===_) M[i++]=65535&v;
        else {
          if (!(16&_)) {
            if (0==(64&_)) { v=p[(65535&v)+(h&((1<<_)-1))]; continue t; }
            if (32&_) { T.mode=12; break e; }
            (e.msg='invalid literal/length code'),(T.mode=30); break e;
          }
          (b=65535&v),(_&=15),_&&(f<_&&((h+=S[n++]<<f),(f+=8)),(b+=h&((1<<_)-1)),(h>>>=_),(f-=_)),
          f<15&&((h+=S[n++]<<f),(f+=8),(h+=S[n++]<<f),(f+=8)),(v=m[h&y]);
          n: for (;;) {
            if ((_=v>>>24),(h>>>=_),(f-=_),(_=(v>>>16)&255),!(16&_)) {
              if (0==(64&_)) { v=m[(65535&v)+(h&((1<<_)-1))]; continue n; }
              (e.msg='invalid distance code'),(T.mode=30); break e;
            }
            if ((w=65535&v),(_&=15),f<_&&((h+=S[n++]<<f),(f+=8),f<_&&((h+=S[n++]<<f),(f+=8))),(w+=h&((1<<_)-1)),w>s) { (e.msg='invalid distance too far back'),(T.mode=30); break e; }
            if (((h>>>=_),(f-=_),(_=i-a),w>_)) {
              if (((_=w-_),_>u&&T.sane)) { (e.msg='invalid distance too far back'),(T.mode=30); break e; }
              if (((x=0),(k=d),0===c)) {
                if (((x+=l-_),_<b)) { b-=_; do { M[i++]=d[x++]; } while (--_); (x=i-w),(k=M); }
              } else if (c<_) {
                if (((x+=l+c-_),(_-=c),_<b)) { b-=_; do { M[i++]=d[x++]; } while (--_); if (((x=0),c<b)) { (_=c),(b-=_); do { M[i++]=d[x++]; } while (--_); (x=i-w),(k=M); } }
              } else if (((x+=c-_),_<b)) { b-=_; do { M[i++]=d[x++]; } while (--_); (x=i-w),(k=M); }
              for (;b>2;) (M[i++]=k[x++]),(M[i++]=k[x++]),(M[i++]=k[x++]),(b-=3);
              b&&((M[i++]=k[x++]),b>1&&(M[i++]=k[x++]));
            } else {
              x=i-w;
              do { (M[i++]=M[x++]),(M[i++]=M[x++]),(M[i++]=M[x++]),(b-=3); } while (b>2);
              b&&((M[i++]=M[x++]),b>1&&(M[i++]=M[x++]));
            }
            break;
          }
        }
        break;
      }
    } while (n<r&&i<o);
    (b=f>>3),(n-=b),(f-=b<<3),(h&=(1<<f)-1),
    (e.next_in=n),(e.next_out=i),(e.avail_in=n<r?r-n+5:5-(n-r)),(e.avail_out=i<o?o-i+257:257-(i-o)),
    (T.hold=h),(T.bits=f);
  };
}

function decodeUint8Array(e: Uint8Array): string {
  return new TextDecoder().decode(e);
}

const D = (e: any): string | null => {
  try {
    const t = new Uint8Array(e);
    return decodeUint8Array(t);
  } catch {
    return null;
  }
};

export const decodeMessage = async (e: string, key: string): Promise<string | undefined> => {
  try {
    const decryptAESGCM = await decryptAES_GCM(e, key);
    const kt = new Kt(e);
    kt.push(decryptAESGCM, undefined);
    const message = D(kt?.result);
    return message ?? undefined;
  } catch {
    return undefined;
  }
};
