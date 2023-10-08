import { MongoClient, ServerApiVersion } from 'mongodb';

const mongoClient = new MongoClient("mongodb://localhost:27017", {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
});

export async function createMongoConnection() {
    try {
        await mongoClient.connect();
        await mongoClient.db("main").command({ ping: 1 });

        if (!(await mongoClient.db("main").listCollections({ name: "attachment_link_cache" }).hasNext())) {
            const collection = await mongoClient.db("main").createCollection("attachment_link_cache");

            await collection.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
            await collection.createIndex({ channelId: 1, messageId: 1, attachmentSnowflake: 1, filename: 1, attachmentLink: 1 });
        }

        console.log("Connected to MongoDB!");
        return mongoClient;
    }
    catch {
        console.error("Failed to connect to MongoDB");
        await mongoClient.close();
        process.exit(1);
    }
}

export const mongoDatabase = mongoClient.db("main");
