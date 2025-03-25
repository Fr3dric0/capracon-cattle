import { Construct } from "constructs";
import { Code, Function, FunctionProps, Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Duration, RemovalPolicy } from "aws-cdk-lib";

interface StandardLambdaFunctionProps {
  name: string;
  handler: string;
  code: Code;
  runtime?: Runtime;
  environment?: Record<string, string>;
  functionOverride?: Partial<FunctionProps>;
}

export class StandardLambdaFunction extends Construct {
  readonly function: Function;

  constructor(scope: Construct, id: string, props: StandardLambdaFunctionProps) {
    super(scope, id);

    this.function = new Function(this, `${id}Function`, {
      functionName: props.name,
      runtime: props.runtime ?? Runtime.PYTHON_3_12,
      handler: props.handler,
      code: props.code,
      tracing: Tracing.ACTIVE,
      memorySize: 1024,
      timeout: Duration.seconds(29),
      environment: props.environment ?? {},
      logGroup: new LogGroup(this, `${id}LogGroup`, {
        logGroupName: `/aws/lambda/${props.name}`,
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      ...props.functionOverride,
    });
  }
}