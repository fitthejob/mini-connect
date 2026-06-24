import path from "node:path"; // resolves file and directory paths
import { fileURLToPath } from "node:url"; // converts import.meta.url to a file path (ESM equivalent of __dirname)
import { createReadStream, mkdirSync, createWriteStream } from "node:fs"; // file system operations
import { ZipArchive } from "archiver"; // cross-platform zip creation
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"; // S3 client and upload command
import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm"; // SSM client for writing version IDs
import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation"; // resolves CloudFormation outputs


const moduleDir = path.dirname(fileURLToPath(import.meta.url)); // resolves the scripts/ dir at runtime
const repositoryRoot = path.resolve(moduleDir, ".."); // resolves the repo root from scripts/

const environment = process.argv[2] ?? "dev"; // environment name, defaults to dev
const lambdaTarget = process.argv[3] ?? "all"; // lambda name or "all", defaults to all

const lambdaDir = path.join(repositoryRoot, "src", "lambdas"); // source dir for Python lambdas
const zipDir = path.join(repositoryRoot, ".staging", "lambdas", environment); // staging dir for zips

const s3Client = new S3Client({}); // uses default AWS credential chain
const ssmClient = new SSMClient({}); // uses default AWS credential chain
const cfnClient = new CloudFormationClient({}); // uses default AWS credential chain

// registry of all lambdas — add new lambdas here
const lambdaRegistry: Record<string, string> = {
  hrs_of_ops: "hrs_of_ops.py",
  member_lookup: "member_lookup.py",
  claims_lookup: "claims_lookup.py",
  provider_lookup: "provider_lookup.py",
  formulary_lookup: "formulary_lookup.py",
  billing_lookup: "billing_lookup.py",
  procedure_lookup: "procedure_lookup.py",
  identity_verify: "identity_verify.py",
};

async function resolveBucketName(): Promise<string> {
  const response = await cfnClient.send(
    new DescribeStacksCommand({ StackName: "MiniConnect-S3" }),
  );
  const outputs = response.Stacks?.[0]?.Outputs ?? [];
  const bucket = outputs.find(
    (o) => o.ExportName === `LambdaArtifactBucketName-${environment}`,
  )?.OutputValue;
  if (!bucket) {
    throw new Error(
      `Could not resolve bucket name from MiniConnect-S3 stack. Is it deployed?`,
    );
  }
  return bucket;
}

async function stageLambda(fileName: string, bucketName: string): Promise<void> {
  const baseName = path.basename(fileName, ".py"); // strips .py to get base name
  const sourcePath = path.join(lambdaDir, fileName); // full path to source file
  const zipPath = path.join(zipDir, `${baseName}.zip`); // full path to zip artifact

  mkdirSync(zipDir, { recursive: true }); // ensure staging dir exists (cross-platform)
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.file(sourcePath, { name: path.basename(sourcePath) }); // add file without directory path
    archive.finalize();
  });

  const stream = createReadStream(zipPath); // stream zip to S3 without loading into memory

  const response = await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName, // resolved from CloudFormation output
      Key: `${baseName}.zip`, // S3 object key
      Body: stream, // streamed zip contents
    }),
  );

  if (!response.VersionId) {
    throw new Error(
      `S3 did not return a VersionId for ${baseName}.zip — ensure versioning is enabled on the bucket`,
    );
  }

  const ssmPath = `/mini-connect/${environment}/lambdas/${baseName}/object_version`; // SSM parameter path

  await ssmClient.send(
    new PutParameterCommand({
      Name: ssmPath,
      Value: response.VersionId, // S3 version ID
      Type: "String",
      Overwrite: true, // update on each staging run
    }),
  );

  console.log(`[${environment}] Staged ${baseName}.zip → s3://${bucketName}/${baseName}.zip`);
  console.log(`[${environment}] Version ID written to SSM: ${ssmPath} = ${response.VersionId}`);
}

async function main(): Promise<void> {
  const bucketName = await resolveBucketName(); // resolve bucket from CloudFormation

  if (lambdaTarget === "all") {
    for (const fileName of Object.values(lambdaRegistry)) {
      await stageLambda(fileName, bucketName);
    }
  } else {
    const fileName = lambdaRegistry[lambdaTarget];
    if (!fileName) {
      throw new Error(
        `Unknown lambda target "${lambdaTarget}". Valid targets: ${Object.keys(lambdaRegistry).join(", ")}, all`,
      );
    }
    await stageLambda(fileName, bucketName);
  }
}

try {
  await main();
} catch (err) {
  console.error(`[${environment}] Staging failed:`, err);
  process.exit(1);
}
