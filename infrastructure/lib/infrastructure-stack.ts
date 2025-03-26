import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
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
import { HealthCheckType } from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";

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
    const isFailoverRegion = currentRegion == PRIMARY_REGION;

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

    // This will control whether our API is alive, and is used to control the
    const apiDomainHealthCheck = new route53.HealthCheck(this, 'ApiHealthCheck', {
      type: HealthCheckType.HTTPS,
      fqdn: apiDomainName,
      resourcePath: '/person',
      measureLatency: true,
      failureThreshold: 5,
      healthThreshold: 2,
    })

    const apiDnsRecord = new route53.ARecord(this, 'ApiDnsRecord', {
      zone: hostedZone,
      recordName: dnsRecordPrefix,
      setIdentifier: isFailoverRegion ? 'failover' : 'primary',
      target: route53.RecordTarget.fromAlias(new route53Targets.ApiGateway(api)),
      healthCheck: apiDomainHealthCheck,
      weight: isFailoverRegion ? 0 : 255,
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