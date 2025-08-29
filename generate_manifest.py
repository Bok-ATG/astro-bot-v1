#!/usr/bin/env python3

import argparse
from string import Template

def main():
    """Generate Slack app manifest from template."""
    parser = argparse.ArgumentParser(description='Generate Slack app manifest from template')
    parser.add_argument('--domain', required=True, help='Domain to replace $domain with')
    parser.add_argument('--app-name', default='AstroBot', help='Slack app name to replace $app_name with (default: AstroBot)')
    parser.add_argument('--display-name', default='AstroBot', help='Bot display name to replace $display_name with (default: AstroBot)')
    parser.add_argument('--mode', choices=['socket', 'http'], default='socket', help='Connection mode (default: socket)')
    parser.add_argument('--input', default='slack_app_manifest_template.yml', help='Input template file (default: slack_app_manifest_template.yml)')
    parser.add_argument('--output', help='Output file (default: stdout)')

    args = parser.parse_args()

    with open(args.input, 'r') as f:
        content = f.read()

    # Determine socket mode value
    socket_mode_enabled = 'true' if args.mode == 'socket' else 'false'

    # Use Template to substitute all variables
    template = Template(content)
    content = template.substitute(
        domain=args.domain,
        app_name=args.app_name,
        display_name=args.display_name,
        socket_mode_enabled=socket_mode_enabled
    )

    if args.output:
        with open(args.output, 'w') as f:
            f.write(content)
        print(f"Manifest generated: {args.output}")
    else:
        print(content)

if __name__ == '__main__':
    main()