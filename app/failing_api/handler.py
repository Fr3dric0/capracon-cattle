import json
import os

def lambda_handler(event, context):
    should_die = os.environ.get('SHOULD_DIE', 'false') == 'true'
    region = os.environ.get('AWS_REGION', 'n/a')

    if should_die:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Failed to start',
                'region': region,
            })
        }

    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Hello world',
            'region': region,
        })
    }

