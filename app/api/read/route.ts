import { Pinecone } from "@pinecone-database/pinecone";
import { queryPineconeVectorStoreAndQueryLLM } from "@/utils";
import { indexName } from "@/config";

export async function POST(req: Request, res: Response) {
  const client = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY ?? "",
    environment: process.env.PINECONE_ENVIRONMENT ?? "",
  });
  const { question } = await req.json();
  console.log(question);
  console.log("REAd NEw");

  const response = await queryPineconeVectorStoreAndQueryLLM(
    client,
    indexName,
    question
  );
  console.log(response);
  return new Response(response, { status: 200 });
}
