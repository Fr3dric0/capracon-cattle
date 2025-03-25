import * as cdk from 'aws-cdk-lib';
import { Construct } from "constructs";
import { CodePipeline, CodePipelineSource, ShellStep } from "aws-cdk-lib/pipelines";
import { AppStage } from "./infrastructure-stack";
import { APPLICATION_NAME } from "./constants";

export class Pipeline extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const pipeline = new CodePipeline(this, 'Pipeline', {
      pipelineName: `${APPLICATION_NAME}-pipeline`,
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.gitHub('Fr3dric0/capracon-cattle', 'master'),
        commands: ['npm ci', 'npm run build', 'npx cdk synth'],
      }),
    });

    pipeline.addStage(new AppStage(this, "Production", { stageName: 'prod' }));
  }
}