# retry-invite-action
An action that will loop through all tickets with the `new-user` and `retry` labels re-sending the GitHub invitation

## Usage
```
on:
  schedule:
    - cron: '*/5 * * * *'

jobs:
  RetryInviteWorkflow:
    runs-on: ubuntu-latest
    steps:
      - name: RetryInviteAction
        uses: chocrates/retry-invite-action@release/v1
        env:
          GITHUB_TOKEN: ${{ secrets.ADMIN_TOKEN }}
```

## Environment Variables
* `GITHUB_TOKEN`: Personal Access Token (PAT) of a member of the organization with privileges to invite users and close issues

### Why is this needed 
The Action needs to create an Octokit context that will be used to send the invites and finally close the issues once that has succeeded

## Contributing
Please submit PR's for any patches you would like to see merged into the mainline.  Ensure that you have written tests covering the new functionality.

## License
All code and documentation released under the [MIT License](LICENSE)
