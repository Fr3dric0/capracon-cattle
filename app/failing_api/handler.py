import os

def html_frame(body: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Capracon cattle</title>
    </head>
    <body>
        {body.strip()}
    </body>
    </html>
    """.strip()

def lambda_handler(event, context):
    should_die = os.environ.get('SHOULD_DIE', 'false') == 'true'
    region = os.environ.get('AWS_REGION', 'n/a')

    if should_die:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'text/html',
            },
            'body': html_frame(f"""
            <header>
            <h1>I have problems in {region}</h1>
            </header>
            <div style="width:100%;height:0;padding-bottom:55%;position:relative;"><iframe src="https://giphy.com/embed/2UCt7zbmsLoCXybx6t" width="100%" height="100%" style="position:absolute" frameBorder="0" class="giphy-embed" allowFullScreen></iframe></div><p><a href="https://giphy.com/gifs/this-is-fine-2UCt7zbmsLoCXybx6t">via GIPHY</a></p>
            """)
        }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'text/html',
        },
        'body': html_frame(f"""
        <header>
        <h1>All good in {region}</h1>
        </header>
        <div style="width:100%;height:0;padding-bottom:83%;position:relative;"><iframe src="https://giphy.com/embed/zhRA0okWxTGiu78uSk" width="100%" height="100%" style="position:absolute" frameBorder="0" class="giphy-embed" allowFullScreen></iframe></div><p><a href="https://giphy.com/gifs/theoffice-the-office-tv-episode-801-zhRA0okWxTGiu78uSk">via GIPHY</a></p>
        """)
    }

