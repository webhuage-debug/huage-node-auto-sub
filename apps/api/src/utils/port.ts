import net from "node:net";

export async function getFreeLocalPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("无法获取本地端口。")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}
