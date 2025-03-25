import json
import os

def lambda_handler(event, context):
    should_die = os.environ.get('SHOULD_DIE', 'false') == 'true'

    if should_die:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Failed to start'
            })
        }

    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Success',
        })
    }

