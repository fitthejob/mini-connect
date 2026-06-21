import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm"; // SSM client for creating placeholder parameters
const environment = process.argv[2] ?? "dev"; // environment name, defaults to dev
const ssmClient = new SSMClient({}); // uses default AWS credential chain
const parameters = [
    `/mini-connect/${environment}/lambdas/hrs_of_ops/object_version`,
    `/mini-connect/${environment}/lambdas/member_lookup/object_version`,
];
async function createPlaceholder(parameterPath) {
    await ssmClient.send(new PutParameterCommand({
        Name: parameterPath,
        Value: "PLACEHOLDER",
        Type: "String",
        Overwrite: false, // do not overwrite if a real version ID already exists
    }));
    console.log(`[${environment}] Created placeholder: ${parameterPath}`);
}
async function main() {
    for (const param of parameters) {
        await createPlaceholder(param);
    }
    console.log(`[${environment}] SSM bootstrap complete.`);
}
try {
    await main();
}
catch (err) {
    console.error(`[${environment}] SSM bootstrap failed:`, err);
    process.exit(1);
}
