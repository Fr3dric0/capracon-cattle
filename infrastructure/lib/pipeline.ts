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

    const environment = 'prod';
    const baseName = `${environment}-${APPLICATION_NAME}`;


    const productionWave = pipeline.addWave('ProductionWave');
    const prodStageProps = { environment: environment, baseName: baseName };

    // Primary: eu-north-1
    productionWave.addStage(
      new AppStage(this, "ProductionEuNorth1", prodStageProps, { stageName: `${environment}-eu-north-1`, env: { region: 'eu-north-1' } }),
    );

    // Failover: eu-west-1
    productionWave.addStage(
      new AppStage(this, "ProductionWest1", prodStageProps, { stageName: `${environment}-eu-west-1`, env: { region: 'eu-west-1' } }),
    );


  }
}