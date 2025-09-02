# Slack Manifest

This folder contains resources for configuring and generating the Slack app manifest for AstroBot.


## Files

- `manifest_template.yml`
  The default Slack app manifest template (YAML format). This template is designed for Socket Mode by default and omits HTTP-specific URL fields. It can be used as-is for Socket Mode deployments, or as a base for generating HTTP-mode manifests.

- `generate_manifest.py`
  A Python script that generates a customized Slack app manifest from the template. It can add the necessary URL fields for HTTP mode or leave them out for Socket Mode.

## Usage

1. **Install dependencies:**

   This script uses [uv](https://docs.astral.sh/uv/getting-started/installation/) to install dependencies:

   ```sh
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. **Generate a manifest:**

   - For Socket Mode (default):
     ```sh
     uv run generate_manifest.py --app-name "AstroBot" --display-name "AstroBot"
     ```
   - For HTTP Mode:
     ```sh
     uv run generate_manifest.py --mode http --domain your.domain.com --app-name "AstroBot" --display-name "AstroBot"
     ```
   - To write output to a file:
     ```sh
     uv run generate_manifest.py --output manifest.yml
     ```

3. **Edit the template:**

   If you need to change the default configuration, edit `manifest_template.yml` and re-run the script.

## References

For more details on Slack app manifests, see the [Slack documentation](https://api.slack.com/reference/manifests).
