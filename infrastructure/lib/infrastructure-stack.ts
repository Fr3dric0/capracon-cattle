import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy, Stack, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { APPLICATION_NAME } from "./constants";
import { StandardLambdaFunction } from "./utils/StandardLambdaFunction";
import { Code } from "aws-cdk-lib/aws-lambda";
import {
  AccessLogFormat,
  Cors,
  EndpointType,
  LambdaIntegration,
  LogGroupLogDestination,
  MethodLoggingLevel,
  RestApi
} from "aws-cdk-lib/aws-apigateway";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { AnyPrincipal, PolicyDocument, PolicyStatement } from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import { HealthCheckType, RecordType } from "aws-cdk-lib/aws-route53";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import { HealthChecker } from "./HealthChecker";

const PRIMARY_REGION = 'eu-north-1';
const HOSTED_ZONE_ID = 'Z07564492IFZPEI4UUD2C';
const HOSTED_ZONE_NAME = 'prod.lokalvert.tech';

interface AppStackProps extends cdk.StackProps {
  readonly environment: string;
}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    const baseName = `${props.environment}-${APPLICATION_NAME}`;

    const currentRegion = Stack.of(this).region;
    const isFailoverRegion = currentRegion != PRIMARY_REGION;

    const hostedZone = this.buildHostedZone();

    const dnsRecordPrefix = 'capracon-cattle';
    const apiDomainName = `${dnsRecordPrefix}.${hostedZone.zoneName}`;

    const certificate = new Certificate(this, 'ApiCertificate', {
      domainName: apiDomainName,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const api = new RestApi(this, 'Api', {
      restApiName: baseName,
      deploy: true,
      endpointTypes: [EndpointType.REGIONAL],
      domainName: {
        domainName: apiDomainName,
        certificate: certificate,
      },
      deployOptions: {
        metricsEnabled: true,
        tracingEnabled: true,
        loggingLevel: MethodLoggingLevel.INFO,
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
        dataTraceEnabled: true,
        accessLogDestination: new LogGroupLogDestination(new LogGroup(this, "ApiAccessLog", {
          removalPolicy: RemovalPolicy.DESTROY,
          retention: RetentionDays.ONE_WEEK,
          logGroupName: `/aws/apigateway/${baseName}`,
        })),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowCredentials: true,
        allowHeaders: ['x-api-key', 'Access-Control-Allow-Origin', 'Authorization'],
      },
      // Let everyone call our API
      policy: new PolicyDocument({
        statements: [new PolicyStatement({
          principals: [new AnyPrincipal()],
          actions: ['execute-api:Invoke'],
          resources: ['execute-api:/*'],
        })],
      }),
    });

    // Calling the backend health endpoint through this construct
    const proxyHealthChecker = new HealthChecker(this, 'ApiHealthChecker', {
      unqualifiedName: 'capracon-cattle',
      baseName: baseName,
      // Check the API Gateway Custom Domain Name directly,
      // but bypass our Route53 Hosted Zone
      healthCheckHostName: api.domainName!!.domainNameAliasDomainName,
      healthCheckOverrideHostHeader: apiDomainName,
      healthCheckPath: '/person',
    });

    /**
     * This determines whether our API is alive.
     * We use it to control when to initiate failover.
     *
     * Tip: If the same domain name is used for both heal
     */
    const apiDomainHealthCheck = new route53.HealthCheck(this, 'ApiHealthCheck', {
      type: HealthCheckType.HTTPS,
      fqdn: proxyHealthChecker.healthCheckTriggerHost,
      measureLatency: true,
      // Important that this endpoint is really certain that the system is unavailable and failover is the correct decision.
      // It is probably wise to not use the Application's health-endpoint, but something dedicated
    });
    // Give the HealthCheck a name
    Tags.of(apiDomainHealthCheck)
      .add('Name', `${apiDomainHealthCheck}-${isFailoverRegion ? 'failover' : 'primary' }`);

    const apiDnsRecord = new route53.CfnRecordSet(this, 'ApiDnsRecord', {
      type: 'A',
      hostedZoneId: hostedZone.hostedZoneId,
      name: apiDomainName,
      setIdentifier: isFailoverRegion ? 'failover' : 'primary',
      failover: isFailoverRegion ? 'SECONDARY' : 'PRIMARY',

      aliasTarget: {
        hostedZoneId: api.domainName!!.domainNameAliasHostedZoneId,
        dnsName: api.domainName!!.domainNameAliasDomainName,
        evaluateTargetHealth: true,
      },
      healthCheckId: apiDomainHealthCheck.healthCheckId,
    });

    const failingApiFunction = new StandardLambdaFunction(this, 'FailingApi', {
      name: `${baseName}-failing-api-v1`,
      handler: 'handler.lambda_handler',
      code: Code.fromAsset('./app/failing_api'),
      environment: {
        SHOULD_DIE: 'false',
      },
    });
    const personPath = api.root.addResource('person');
    personPath.addMethod('GET', new LambdaIntegration(failingApiFunction.function));
  }

  private buildHostedZone() {
    return route53.HostedZone.fromHostedZoneAttributes(this, 'LokalvertHostedZone', {
      hostedZoneId: HOSTED_ZONE_ID,
      zoneName: HOSTED_ZONE_NAME,
    })
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