import webpack from "webpack";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    config.externals.push("pino-pretty", "lokijs", "encoding")

    if (isServer) {
      config.plugins.push(
        new webpack.ProvidePlugin({
          indexedDB: ["fake-indexeddb", "indexedDB"],
          IDBCursor: ["fake-indexeddb", "IDBCursor"],
          IDBDatabase: ["fake-indexeddb", "IDBDatabase"],
          IDBFactory: ["fake-indexeddb", "IDBFactory"],
          IDBIndex: ["fake-indexeddb", "IDBIndex"],
          IDBKeyRange: ["fake-indexeddb", "IDBKeyRange"],
          IDBObjectStore: ["fake-indexeddb", "IDBObjectStore"],
          IDBOpenDBRequest: ["fake-indexeddb", "IDBOpenDBRequest"],
          IDBRequest: ["fake-indexeddb", "IDBRequest"],
          IDBTransaction: ["fake-indexeddb", "IDBTransaction"],
        })
      )
    }

    return config
  },
}

export default nextConfig


