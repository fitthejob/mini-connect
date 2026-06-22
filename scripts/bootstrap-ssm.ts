import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm"; // SSM client for creating placeholder parameters

const environment = process.argv[2] ?? "dev"; // environment name, defaults to dev

const ssmClient = new SSMClient({}); // uses default AWS credential chain

const parameters = [
  `/mini-connect/${environment}/lambdas/hrs_of_ops/object_version`,
  `/mini-connect/${environment}/lambdas/member_lookup/object_version`,
  `/mini-connect/${environment}/lambdas/claims_lookup/object_version`,
  `/mini-connect/${environment}/lambdas/provider_lookup/object_version`,
  `/mini-connect/${environment}/lambdas/formulary_lookup/object_version`,
  `/mini-connect/${environment}/lambdas/billing_lookup/object_version`,
  `/mini-connect/${environment}/lambdas/procedure_lookup/object_version`,
];

async function createPlaceholder(parameterPath: string): Promise<void> {
  try {
    await ssmClient.send(
      new PutParameterCommand({
        Name: parameterPath,
        Value: "PLACEHOLDER",
        Type: "String",
        Overwrite: false, // do not overwrite if a real version ID already exists
      }),
    );
    console.log(`[${environment}] Created placeholder: ${parameterPath}`);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "ParameterAlreadyExists") {
      console.log(`[${environment}] Parameter already exists, skipping: ${parameterPath}`);
      return;
    }
    throw err;
  }
}

async function main(): Promise<void> {
  for (const param of parameters) {
    await createPlaceholder(param);
  }
  console.log(`[${environment}] SSM bootstrap complete.`);
}

try {
  await main();
} catch (err) {
  console.error(`[${environment}] SSM bootstrap failed:`, err);
  process.exit(1);
}
