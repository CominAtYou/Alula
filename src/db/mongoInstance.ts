import { MongoClient, ServerApiVersion } from 'mongodb'

const mongoClient: MongoClient = new MongoClient("mongodb://localhost:27017", {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
});

export async function createMongoConnection() {
    await mongoClient.connect();
    try {
        await mongoClient.db("main").command({ ping: 1 });
        console.log("Connected to MongoDB!");
        return mongoClient;
    }
    catch {
        console.error("Failed to connect to MongoDB");
        await mongoClient.close();
        process.exit(1);
    }
}

export function getMongoDatabase() {
    return mongoClient.db("main");
};
