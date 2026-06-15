# mini-connect (A reference implementation of the connect-flow-builder package)

`mini-connect` is a minimal CDK consumer repo that proves how `connect-flow-builder` can be integrated into a real deployment path.

Live repos:

- Reference CDK consumer: [fitthejob/mini-connect](https://github.com/fitthejob/mini-connect)
- Package repo: [fitthejob/connect-flow-builder](https://github.com/fitthejob/connect-flow-builder)

It is not the `connect-flow-builder` package itself, and it is not intended to be a polished starter kit. The purpose of `mini-connect` is to serve as a reference integration:

- `connect-flow-builder` owns flow authoring, validation, and staged rendering
- `mini-connect` owns AWS resource wiring, CDK stacks, and deployment
- the current implementation proves that separation against a live Amazon Connect instance

## What This Repo Proves

This repo demonstrates a working Amazon Connect deployment path where:

- a standalone TypeScript package defines flows as code
- a CDK app creates the Connect instance and related resources
- the CDK flow stack renders and deploys flow JSON from the same flow catalog
- cross-flow and external resource bindings are resolved at deployment time

The current proven path includes:

- a Connect instance stack
- a queue and hours-of-operation stack
- a contact flow stack
- a customer queue flow plus a main inbound contact flow
- a working inbound queue handoff pattern using:
  `Set customer queue flow` -> `Set working queue` -> `TransferContactToQueue`

## Repo Shape

```text
mini-connect/
|- bin/
|  |- mini-connect.ts
|- lib/
|  |- connect-instance-stack.ts
|  |- connect-queues-stack.ts
|  |- contact-flows-stack.ts
|- scripts/
|  |- stage-contact-flows.ts
|- src/
|  |- flows/
|     |- catalog.ts
|     |- support-queue-experience.ts
|     |- main-inbound.ts
|- connect-flow-builder/
```

## Integration Model

This repo vendors `connect-flow-builder` locally as:

```text
connect-flow-builder/
```

and consumes it through the dependency entry in `package.json`:

```json
"connect-flow-builder": "file:./connect-flow-builder"
```

That local package provides:

- typed Amazon Connect action builders
- flow validation
- flow catalog rendering
- staged flow artifact output

This repo then adds the consumer-specific pieces:

- Connect instance creation
- queue creation
- flow deployment with `aws-cdk-lib/aws-connect`
- environment-specific resource bindings

If you want the standalone package itself, rather than the reference CDK integration, see:

- [fitthejob/connect-flow-builder](https://github.com/fitthejob/connect-flow-builder)

## Architecture Connection Points

This is the most important architectural split in the repo.

### Package-side flow authoring layer

These files come from the vendored `connect-flow-builder` package and provide the reusable flow-authoring engine:

- `connect-flow-builder/src/index.ts`
  Public package exports consumed by this repo

- `connect-flow-builder/src/core/`
  Core flow model, JSON rendering, and validation

- `connect-flow-builder/src/staging/`
  Flow catalog rendering and staged artifact support

- `connect-flow-builder/src/actions/`
  Typed Amazon Connect action builders

`mini-connect` consumes the `connect-flow-builder` runtime architecture, and does not modify it.

### Consumer-side flow definition layer

These files define the actual flows for this reference consumer:

- `src/flows/support-queue-experience.ts`
  Defines the `CUSTOMER_QUEUE` flow using package builders

- `src/flows/main-inbound.ts`
  Defines the `CONTACT_FLOW` using package builders and cross-flow references

- `src/flows/catalog.ts`
  Registers those flow specs into one `FlowCatalog`

This is the point where consumer-owned business flow definitions start.

### Consumer-side staging layer

- `scripts/stage-contact-flows.ts`
  Imports `renderFlowCatalog` and `writeRenderedFlowCatalog` from `connect-flow-builder`, renders the consumer `flowCatalog`, and writes review artifacts into `.staging/contact-flows/<env>/`

This is the review boundary between authored flow code and deployment.

### Consumer-side deployment layer

- `lib/connect-instance-stack.ts`
  Creates the Amazon Connect instance and exports the instance ARN

- `lib/connect-queues-stack.ts`
  Creates hours of operation and the support queue, then exports the queue ARN

- `lib/contact-flows-stack.ts`
  Imports the consumer `flowCatalog`, calls `renderFlowCatalog(...)`, injects deploy-time bindings, and creates `CfnContactFlow` resources

- `bin/mini-connect.ts`
  Wires the three stacks together and passes instance and queue outputs downstream

This is the point where authored flows become deployable AWS resources.

## End-to-End File-Level Flow

The current build path looks like this:

```text
src/flows/support-queue-experience.ts
src/flows/main-inbound.ts
  -> src/flows/catalog.ts
  -> scripts/stage-contact-flows.ts        review-time render path
  -> lib/contact-flows-stack.ts            deploy-time render path
  -> aws-cdk-lib/aws-connect CfnContactFlow
  -> deployed Amazon Connect flows
```

A slightly more detailed view is:

```text
connect-flow-builder/src/index.ts
  exports FlowBuilder, FlowSpec, renderFlowCatalog, action builders

src/flows/main-inbound.ts
src/flows/support-queue-experience.ts
  import from connect-flow-builder
  define flow specs

src/flows/catalog.ts
  combines flow specs into one FlowCatalog

scripts/stage-contact-flows.ts
  renders placeholder-based staged artifacts for review

lib/contact-flows-stack.ts
  renders the same catalog again with real queue and flow bindings
  deploys CfnContactFlow resources

bin/mini-connect.ts
  composes the instance, queue, and flow stacks into one CDK app
```

## Current Stack Topology

The CDK app currently defines three stacks:

1. `MiniConnect-Instance`
2. `MiniConnect-Queues`
3. `MiniConnect-ContactFlows`

The deployment order is:

```text
MiniConnect-Instance
  -> MiniConnect-Queues
  -> MiniConnect-ContactFlows
```

The contact flow stack depends on the queue stack and the instance stack because it needs:

- the Connect instance ARN
- the support queue ARN
- the deployed customer queue flow ARN for inter-flow binding

## Flow Deployment Pattern

The current deployment pattern is:

1. define flow specs in `src/flows/`
2. stage reviewable artifacts with `scripts/stage-contact-flows.ts`
3. deploy the customer queue flow first
4. render the main inbound flow with real queue and flow bindings
5. deploy the main inbound flow from CDK

The contact flow stack is the current source of truth for the deploy-time integration shape.

## Why The Flow Stack Renders Again

The staging script and the CDK stack both render from the same `flowCatalog`, but they do different jobs:

- `scripts/stage-contact-flows.ts`
  renders review artifacts using placeholder-style bindings

- `lib/contact-flows-stack.ts`
  renders deployable flow content using real values from the instance and queue stacks

That separation is intentional. It allows the same authored flow definitions support for both review and deployment without making the `connect-flow-builder` package own CDK behavior.

## Prerequisites

Before running this repo, you should have:

- Node.js installed
- npm installed
- AWS credentials for the target account
- the correct `AWS_PROFILE` selected if you use profiles
- CDK bootstrapped in the target account and region

A typical profile export looks like:

```bash
export AWS_PROFILE=my-profile
```

## Install

From the `mini-connect` repo root:

```bash
npm install
```

## Stage Flow Artifacts

To render staged flow artifacts locally:

```bash
npm run stage:flows
```

This writes staged output to:

```text
.staging/contact-flows/dev/
```

Use staged output for review.

The deployed flow content is ultimately rendered again inside the CDK flow stack using real bindings.

## Synthesize The CDK App

```bash
npm run cdk:synth
```

To synth only the flow stack:

```bash
npx cdk synth MiniConnect-ContactFlows
```

## Deploy The Current Reference Integration

Deploy the stacks in order:

```bash
npx cdk deploy MiniConnect-Instance
npx cdk deploy MiniConnect-Queues
npx cdk deploy MiniConnect-ContactFlows
```

## Important Notes

- This repo is a reference integration, not a generic operator product.
- It is intentionally minimal and currently focused on proving the package-to-CDK boundary.
- The packaged `connect-flow-builder` repo remains the portable source of truth for flow authoring concerns.
- This repo remains the consumer-side example of how those flows can be staged, bound, and deployed.

## When To Use This Repo

Use `mini-connect` when you want to:

- understand the intended consumer architecture
- see how `connect-flow-builder` fits into a CDK deployment path
- validate the current proven inbound queueing pattern
- reuse this shape as a starting point for another consumer repo

Do not treat `mini-connect` as a production-ready framework. Treat it as a working reference implementation that uses the `connect-flow-builder` package.
