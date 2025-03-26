import { Construct } from "constructs";
import * as cdk from 'aws-cdk-lib';
import { Code, FunctionUrlAuthType, IFunction } from "aws-cdk-lib/aws-lambda";
import { StandardLambdaFunction } from "./utils/StandardLambdaFunction";

export interface HealthCheckerProps {
  readonly baseName: string;
  readonly unqualifiedName: string
  readonly healthCheckHostName: string;
  readonly healthCheckPath: string;
  readonly healthCheckOverrideHostHeader?: string;
}

/**
 * Proxy resource you can use to run health checks against `props.healthCheckHostName`.
 * Built it because we needed the ability to specify a different `Host` header
 * in the request, than what is specified in the request.
 * */
export class HealthChecker extends Construct {
  readonly healthChecker: IFunction
  readonly healthCheckTriggerHost: string;

  constructor(scope: Construct, id: string, props: HealthCheckerProps) {
    super(scope, id);

    const healthChecker = new StandardLambdaFunction(this, 'HealthChecker', {
      name: `${props.baseName}-${props.unqualifiedName}-healthcheck`,
      handler: 'handler.lambda_handler',
      code: Code.fromAsset('./app/dns_health_checker'),
      environment: {
        HEALTH_ENDPOINT_HOST: props.healthCheckHostName,
        HEALTH_ENDPOINT_PATH: props.healthCheckPath,
        OVERRIDE_HOST_HEADER: props.healthCheckOverrideHostHeader ?? '',
      }
    })

    const functionUrl = healthChecker.function.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    });
    this.healthChecker = healthChecker.function;

    this.healthCheckTriggerHost = this.strippedFunctionUrl(functionUrl.url);
  }

  /**
   * We get the function URL with 'https://' and '/' at the end.
   * This is annoying for consumers of this value, as they only want the hostname itself
   * */
  private strippedFunctionUrl(functionUrl: string) {
    const withoutProtocol = cdk.Fn.select(1, cdk.Fn.split('https://', functionUrl))
    const withoutTrailingSlash = cdk.Fn.select(0, cdk.Fn.split('/', withoutProtocol));

    return withoutTrailingSlash;
  }
}