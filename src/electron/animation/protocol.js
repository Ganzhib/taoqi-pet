"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { protocol } = require("electron");
const { PET_SCHEME, petsRoot } = require("./artwork-source");

const MIME_TYPES = {
  ".webm": "video/webm",
  ".gif": "image/gif",
};

// 必须在 app ready 之前调用。
//
// 只有注册成 standard scheme，Chromium 才会把 pet:// 当成 HTTP 一样对待：
// 支持 fetch、Range 请求、媒体流式加载。少了 stream 权限，<video> 拿不到
// 连续数据，播放器会直接报 MEDIA_ELEMENT_ERROR。
function registerPetScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PET_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        bypassCSP: true,
      },
    },
  ]);
}

function registerPetProtocol() {
  protocol.handle(PET_SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
    const root = petsRoot();
    const file = path.resolve(root, relative);
    // 目录穿越防护：解析后的路径必须还在素材目录里
    if (file !== root && !file.startsWith(root + path.sep)) {
      return new Response("forbidden", { status: 403 });
    }
    const mime = MIME_TYPES[path.extname(file).toLowerCase()];
    if (!mime) return new Response("unsupported media type", { status: 415 });

    let data;
    try {
      // Electron 的 fs 能读 asar 包内的文件
      data = await fs.promises.readFile(file);
    } catch {
      return new Response("not found", { status: 404 });
    }

    const headers = {
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Content-Length": String(data.length),
    };
    // 媒体播放器通常带 Range 请求，不回 206 它可能无法起播
    const range = request.headers.get("Range");
    const matched = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
    if (matched) {
      const start = matched[1] === "" ? 0 : Number(matched[1]);
      const end = matched[2] === "" ? data.length - 1 : Math.min(Number(matched[2]), data.length - 1);
      if (start <= end && start < data.length) {
        const slice = data.subarray(start, end + 1);
        return new Response(new Uint8Array(slice), {
          status: 206,
          headers: {
            ...headers,
            "Content-Range": "bytes " + start + "-" + end + "/" + data.length,
            "Content-Length": String(slice.length),
          },
        });
      }
    }
    return new Response(new Uint8Array(data), { headers });
  });
}

module.exports = { registerPetScheme, registerPetProtocol };
