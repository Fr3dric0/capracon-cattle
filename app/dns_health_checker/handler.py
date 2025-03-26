import json
import os
import http.client
import typing


def run_http_get(host: str, path: str, override_host: typing.Optional[str] = None) -> typing.Tuple[int, str, dict]:
    connection = http.client.HTTPSConnection(host)

    if override_host is not None:
        connection.request('GET', path, headers={'Host': override_host})
    else:
        connection.request('GET', path)

    response = connection.getresponse()
    data = response.read()

    return (response.status, data.decode('utf-8'), response.headers)


def lambda_handler(request, context):
    health_endpoint_host = os.environ.get('HEALTH_ENDPOINT_HOST')
    health_endpoint_path = os.environ.get('HEALTH_ENDPOINT_PATH')
    if not health_endpoint_path.startswith('/'):
        # We must have a leading '/'
        health_endpoint_path = f'/{health_endpoint_path}'

    override_host_header = os.environ.get('OVERRIDE_HOST_HEADER', None)
    if len(override_host_header) < 1:
        override_host_header = None

    print(f'Checking if endpoint ({health_endpoint_host}{health_endpoint_path}) is alive. Override host: {override_host_header})')

    (response_status, response_body, headers) = run_http_get(health_endpoint_host, health_endpoint_path, override_host_header)

    if response_status >= 400:
        print(f'Health-checks on endpoint ({health_endpoint_host}/{health_endpoint_path}) failed. Status={response_status}, body={response_body}, headers={headers})')
        return {
            'statusCode': 503,
            'body': json.dumps({
               'error': 'Health check failed',
            }),
        }

    print(f'Health check succeeded')
    return {
        'statusCode': 204,
    }

if __name__ == '__main__':
    os.environ.setdefault('HEALTH_ENDPOINT_HOST', 'd-7x9nqpbnl7.execute-api.eu-west-1.amazonaws.com')
    os.environ.setdefault('HEALTH_ENDPOINT_PATH', '/person')
    os.environ.setdefault('OVERRIDE_HOST_HEADER', 'capracon-cattle.prod.lokalvert.tech')

    lambda_handler({}, {})