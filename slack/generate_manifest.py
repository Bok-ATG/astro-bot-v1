#!/usr/bin/env python3


import argparse
import yaml

def main():
    """Generate Slack app manifest from template using PyYAML."""
    parser = argparse.ArgumentParser(description='Generate Slack app manifest from template')
    parser.add_argument('--app-name', default='AstroBot', help='Slack app name (default: AstroBot)')
    parser.add_argument('--display-name', default='AstroBot', help='Bot display name (default: AstroBot)')
    parser.add_argument('--mode', choices=['socket', 'http'], default='socket', help='Connection mode (default: socket)')
    parser.add_argument('--domain', help='Domain for HTTP mode (required for http mode)')
    parser.add_argument('--input', default='manifest_template.yml', help='Input template file (default: manifest_template.yml)')
    parser.add_argument('--output', help='Output file (default: stdout)')

    args = parser.parse_args()

    # Load YAML template as dict
    with open(args.input, 'r') as f:
        template_dict = yaml.safe_load(f)

    # Update basic info
    template_dict['display_information']['name'] = args.app_name
    template_dict['features']['bot_user']['display_name'] = args.display_name

    # Add url fields for http mode
    if args.mode == 'http':
        template_dict['settings']['socket_mode_enabled'] = False
        if not args.domain:
            parser.error('--domain is required in http mode')

        for cmd in template_dict.get('features', {}).get('slash_commands', []):
            cmd['url'] = f"https://{args.domain}/slack/events"
        if 'settings' in template_dict and 'event_subscriptions' in template_dict['settings']:
            template_dict['settings']['event_subscriptions']['request_url'] = f"https://{args.domain}/slack/events"
        if 'settings' in template_dict and 'interactivity' in template_dict['settings']:
            template_dict['settings']['interactivity']['request_url'] = f"https://{args.domain}/slack/events"
        if 'oauth_config' in template_dict:
            template_dict['oauth_config']['redirect_urls'] = [f"https://{args.domain}/slack/oauth_redirect"]

    # Output YAML
    output_yaml = yaml.safe_dump(template_dict, sort_keys=False, default_flow_style=False)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(output_yaml)
        print(f"Manifest generated: {args.output}")
    else:
        print(output_yaml)

if __name__ == '__main__':
    main()