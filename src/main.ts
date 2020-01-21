import * as core from "@actions/core";
import * as github from "@actions/github";

function getEmail(issueBody: string, regexString: string): string {
  const emailRegex = new RegExp(regexString);

  const match = issueBody.match(emailRegex);

  if (match && match[1]) {
    // Return the first capture group
    return match[1];
  } else {
    throw Error("No valid email matches");
  }
}

async function run(): Promise<void> {
  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (GITHUB_TOKEN) {
      const octokit: github.GitHub = new github.GitHub(GITHUB_TOKEN);
        
      const owner: string = core.getInput("OWNER");
      const repo: string = core.getInput("REPO");

      const emailRegex: string = core.getInput("EMAIL_REGEX");
      const userRole: string = core.getInput("USER_ROLE") || "direct_member";

      // This is actually an array but so far can't figure out how to make Typescript know that
      const issues: any = await octokit.issues.listForRepo({
        owner,
        repo,
        labels: "new-user,retry"
      });

      for (const issue of issues.slice(0, 500)) {
        const email = getEmail(issue.body, emailRegex);
        try {
          await octokit.orgs.createInvitation({
            org: owner,
            role: userRole as any,
            email
          });
        } catch (error) {
          if (
            error.errors.filter(
              (e: any) => e.message === "Over invitation rate limit"
            ).length > 0
          ) {
            break; // Stop execution, we can't run any more
          } else {
            await octokit.issues.addLabels({
              owner,
              repo,
              issue_number: issue.number,
              labels: ["automation-failed"]
            });
            continue;
          }
        }

        await octokit.issues.addLabels({
          owner,
          repo,
          issue_number: issue.number,
          labels: ["processed"]
        });

        await octokit.issues.update({
          owner,
          repo,
          issue_number: issue.number,
          state: "closed"
        }); 
      } 
    } else {
      throw Error("Token Not Provided");
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

if (!module.parent) {
  run();
}

export { run, getEmail };
