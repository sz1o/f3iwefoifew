/*
 * N.S Vault — Ultraviolet config
 *
 * bare: where the Bare v1 backend lives.
 *   "/bare/"  -> the backend built into server.js (same origin, recommended).
 *   Full URL  -> e.g. "https://my-bare-server.example/bare/" if you host the
 *                backend somewhere else (it must send CORS headers).
 */
self.__uv$config = {
    prefix: '/home/go/',
    bare: '/bare/',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: '/home/uv/uv.handler.js',
    bundle: '/home/uv/uv.bundle.js',
    config: '/home/uv/uv.config.js',
    sw: '/home/uv/uv.sw.js',
};
