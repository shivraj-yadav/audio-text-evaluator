import { MongoClient } from 'mongodb'

let client

export async function getDbClient() {
  if (client && client.topology?.isConnected()) return client
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/audio_eval'
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 })
  if (!client.topology?.isConnected()) {
    await client.connect()
  }
  return client
}

export async function getDb() {
  const c = await getDbClient()
  // If a DB name is embedded in the URI it will be used; otherwise default.
  const dbName = new URL(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/audio_eval').pathname.replace('/', '') || 'audio_eval'
  return c.db(dbName)
}
