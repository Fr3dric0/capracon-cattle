import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { APPLICATION_NAME } from "./constants";
import { StandardLambdaFunction } from "./utils/StandardLambdaFunction";
import { Code } from "aws-cdk-lib/aws-lambda";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

interface AppStackProps extends cdk.StackProps {
  readonly environment: string;
}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    const baseName = `${props.environment}-${APPLICATION_NAME}`;

    const failingApiFunction = new StandardLambdaFunction(this, 'FailingApi', {
      name: `${baseName}-failing-api-v1`,
      handler: 'handler.lambda_handler',
      code: Code.fromAsset('./app/failing_api'),
      environment: {
        SHOULD_DIE: 'false',
      },
    });
  }
}

export class AppStageProps {
  readonly baseName: string;
  readonly environment: string;
}

export class AppStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: AppStageProps, stageProps: cdk.StageProps) {
    super(scope, id, stageProps);

    new AppStack(this, 'AppStack', {
      stackName: props.baseName,
      environment: props.environment,
    });
  }
}