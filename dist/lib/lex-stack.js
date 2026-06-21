import * as cdk from "aws-cdk-lib";
import * as lex from "aws-cdk-lib/aws-lex";
import * as iam from "aws-cdk-lib/aws-iam";
import * as connect from "aws-cdk-lib/aws-connect";
import { renderBotLocales } from "../src/bots/render.js";
export class LexStack extends cdk.Stack {
    botAliasArn;
    constructor(scope, id, props) {
        super(scope, id, props);
        const lexRole = new iam.Role(this, `LexRole-${props.envName}`, {
            assumedBy: new iam.ServicePrincipal("lexv2.amazonaws.com"),
        });
        lexRole.addToPolicy(new iam.PolicyStatement({
            actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
            ],
            resources: ["arn:aws:logs:*:*:*"],
        }));
        const bot = new lex.CfnBot(this, `${props.catalog.name}-${props.envName}`, {
            name: `${props.catalog.name}-${props.envName}`,
            roleArn: lexRole.roleArn,
            dataPrivacy: {},
            idleSessionTtlInSeconds: 300,
            autoBuildBotLocales: true,
            botLocales: renderBotLocales(props.catalog),
        });
        bot.addPropertyOverride("DataPrivacy", { ChildDirected: false }); // CDK emits camelCase; CFN requires PascalCase
        const botVersion = new lex.CfnBotVersion(this, `${props.catalog.name}Version-${props.envName}`, {
            botId: bot.ref,
            botVersionLocaleSpecification: props.catalog.locales.map((localeId) => ({
                localeId,
                botVersionLocaleDetails: { sourceBotVersion: "DRAFT" },
            })),
        });
        const botAlias = new lex.CfnBotAlias(this, `${props.catalog.name}Alias-${props.envName}`, {
            botId: bot.ref,
            botAliasName: `live-${props.envName}`,
            botVersion: botVersion.attrBotVersion,
        });
        this.botAliasArn = botAlias.attrArn;
        new lex.CfnResourcePolicy(this, `BotConnectAssociation-${props.envName}`, {
            resourceArn: botAlias.attrArn,
            policy: {
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Principal: {
                            Service: "connect.amazonaws.com",
                        },
                        Action: "lex:RecognizeText",
                        Resource: botAlias.attrArn,
                        Condition: {
                            StringEquals: {
                                "aws:SourceArn": props.instanceArn,
                                "aws:SourceAccount": cdk.Stack.of(this).account,
                            },
                        },
                    },
                ],
            },
        });
        new connect.CfnIntegrationAssociation(this, `LexBotIntegration-${props.envName}`, {
            instanceId: props.instanceArn, // CfnIntegrationAssociation expects the full instance ARN
            integrationType: "LEX_BOT",
            integrationArn: botAlias.attrArn,
        });
        new cdk.CfnOutput(this, `BotAliasArn-${props.envName}`, {
            value: this.botAliasArn,
            description: "Lex bot alias ARN for Connect flow integration",
        });
    }
}
