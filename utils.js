import { Pinecone } from "@pinecone-database/pinecone";
import { Tensor, pipeline } from "@xenova/transformers";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Vector } from "@pinecone-database/pinecone/dist/pinecone-generated-ts-fetch";
import { Document } from "langchain/document";
import {
  chunkBatchSize,
  modelname,
  topK,
  verbose_utils,
  verbose_ask,
} from "./config";
import { LLMChain, loadQAStuffChain } from "langchain/chains";
import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import { FeatureExtractionPipelineClass } from "./FeatureExtractionPipeline.js"

import { HfInference, featureExtraction } from '@huggingface/inference'

export async function createPineconeIndex(
  client,
  indexName,
  vectorDimensions
) {
  console.log(`Checking "${indexName}"...`);
  const existingIndexes = await client.listIndexes();
  if (!client.Index(indexName)) {
    console.log("index doesnt exist");
    // await new Promise((resolve)=>setTimeout(resolve, timeout))
  }
}

export async function updateVectorDB(
  client,
  indexName,
  docs
) {
  //get pine cone ready
  const index = client.Index(indexName);
  console.log(`Index retrieved "${indexName}"`);

  // get extraction pipeline ready
  const extractor = await pipeline("feature-extraction", modelname);

  for (const doc of docs) {
    //each doc -> chunks
    const filename = getfilename(doc.metadata.source);
    console.log(filename);

    // console.log(`Processing document "${doc.metadata.source}"...`);
    const txtPath = doc.metadata.source;
    const text = doc.pageContent;
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
    });

    // const chunks = await textSplitter.splitText(text);
    const chunks = await textSplitter.splitText(text);
    console.log(`Split document into "${chunks.length}" chunks`);
    console.log(chunks);
    // break;

    const timeHook = new Date();
    let chunk_batch_count = 0;
    while (chunks.length > 0) {
      console.log("chunks length: " + chunks.length);

      chunk_batch_count++;
      const chunkBatch = chunks.splice(0, chunkBatchSize);
      console.log("chunkBatch: " + chunkBatch.length);

      // chunks -> tensors -> embeddingsArray
      const output = await extractor(
        chunkBatch.map((chunk) => chunk.replace(/\n/g, " ")),
        {
          pooling: "mean",
          normalize: true,
        }
      );
      // break;
      console.log(output);
      const embeddingsArray = (Array.from(output)).map((tensor) =>
        Array.from(tensor)
      );
      console.log(embeddingsArray);
      console.log("embeddings length: " + embeddingsArray.length);

      // embeddingsArray -> VectorArray
      const batchSize = 100;
      let batch = [];
      for (let chunkIdx = 0; chunkIdx < chunkBatch.length; chunkIdx++) {
        const embedding = embeddingsArray[chunkIdx];
        const chunk = chunkBatch[chunkIdx];

        const vector = {
          id: `${chunkIdx}_${chunk_batch_count}_${txtPath}`,
          values: embedding,
          metadata: {
            chunk: chunk,
            filename: filename,
          },
        };
        batch = [...batch, vector];

        if (batch.length >= batchSize || chunkIdx === chunkBatch.length - 1) {
          await index.upsert(batch);
          console.log(`Upserted "${batch.length}" vectors to database`);
          batch = [];
        }
      }

      //time logging
      const timeAssess = new Date();
      const timeDiff = timeAssess.getTime() - timeHook.getTime();
      const timediffFormat = new Date(timeDiff).toISOString().slice(11, 19);
      console.log("Time taken: " + timediffFormat + " s");
    }
    console.log("while loop ended with chunks length: " + chunks.length);
  }
}

export async function queryPineconeVectorStoreAndQueryLLM(
  client,
  indexName,
  question
) {
  // get extraction pipeline ready

  const extractor = await FeatureExtractionPipelineClass.getInstance();

  const output = await extractor(question, {
    pooling: "mean",
    normalize: true,
  });
  

  console.log(output);
  const queryEmbedding = Array.from(output.data);
  console.log("Querying database vector store...");
  const index = client.Index(indexName);
  let queryResponse = await index.query({
    topK: topK,
    vector: queryEmbedding,
    includeMetadata: true,
    includeValues: true,
  });

  console.log(`Found "${queryResponse.matches.length}" matches`);

  if (queryResponse.matches.length) {
    const concatenatedPageContent = queryResponse.matches
      .map((match) => match.metadata?.chunk)
      .join(" | ");

    // TODO: TRY OTHER LLMs
    const llm = new OpenAI();
    // TODO: REFINE PROMPT
    // const promptString = `Use the following pieces of context to answer the question at the end. Some context might be irrelevant. If it is not possible to accurately determine the answer, then respond by saying "CANNOT_ACCURATELY_DETERMINE_THE_ANSWER".\n\nContext: {concatenatedPageContent} \n\nQuestion: {userQuestion} \n\nAnswer:`;
    const promptString = `Use the following pieces of context to answer the question at the end. If it is not possible to accurately determine the answer, then respond by saying "CANNOT_ACCURATELY_DETERMINE_THE_ANSWER".\n\nContext: {concatenatedPageContent} \n\nQuestion: {userQuestion} \n\nAnswer:`;
    const prompt = PromptTemplate.fromTemplate(promptString);

    const chainA = new LLMChain({ llm: llm, prompt: prompt });
    const resultA = await chainA.call({
      concatenatedPageContent: concatenatedPageContent,
      userQuestion: question,
    });
    console.log(resultA.text);
    return resultA.text;
  } else {
    console.log("Since there were no matches, GPT won't be called.");
    return "Cannot find answer to that question.";
  }
}

function getfilename(filename) {
  const docname = filename.substring(filename.lastIndexOf("/") + 1);
  return docname.substring(0, docname.lastIndexOf(".")) || docname;
}
