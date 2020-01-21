/* global octomock */
import { run, getEmail } from "../src/main";
let issueNumber = 1;
let login = "User";
let name = "RepoName";
let testEmail = "testEmail@email.com";
let issues = [
  {
    url: "",
    number: 1,
    title: "Issue 1",
    user: {
      login: ""
    },
    labels: [
      {
        name: "new-user"
      },
      {
        name: "retry"
      }
    ],
    body: `<p>Username: User</p>\n<p>Email of Requester: ${testEmail}</p>\n<p>Other stuff: and things</p>`
  },
  {
    url: "",
    number: 2,
    title: "Issue 1",
    user: {
      login: ""
    },
    labels: [
      {
        name: "new-user"
      },
      {
        name: "retry"
      }
    ],
    body: `<p>Username: User</p>\n<p>Email of Requester: ${testEmail}</p>\n<p>Other stuff: and things</p>`
  },
  {
    url: "",
    number: 3,
    title: "Issue 1",
    user: {
      login: ""
    },
    labels: [
      {
        name: "new-user"
      },
      {
        name: "retry"
      }
    ],
    body: `<p>Username: User</p>\n<p>Email of Requester: ${testEmail}</p>\n<p>Other stuff: and things</p>`
  }
];

let buildIssueReturn = (issues: any) => {
  return {
    status: 200,
    url:
      "https://api.github.com/repos/department-of-veterans-affairs/github-actions-poc/issues?labels=new-user%2Cretry",
    headers: {
      "access-control-allow-origin": "*",
      "access-control-expose-headers":
        "ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type",
      "cache-control": "private, max-age=60, s-maxage=60",
      connection: "close",
      "content-encoding": "gzip",
      "content-security-policy": "default-src 'none'",
      "content-type": "application/json; charset=utf-8",
      date: "Tue, 21 Jan 2020 16:38:14 GMT",
      etag: 'W/"4af917573a743f62226a729beb081ed6"',
      "referrer-policy":
        "origin-when-cross-origin, strict-origin-when-cross-origin",
      server: "GitHub.com",
      status: "200 OK",
      "strict-transport-security":
        "max-age=31536000; includeSubdomains; preload",
      "transfer-encoding": "chunked",
      vary: "Accept, Authorization, Cookie, X-GitHub-OTP",
      "x-accepted-oauth-scopes": "repo",
      "x-content-type-options": "nosniff",
      "x-frame-options": "deny",
      "x-github-media-type": "github.v3; format=json",
      "x-github-request-id": "0601:0743:22D40B:5400A5:5E2728F6",
      "x-oauth-scopes": "admin:org, repo, user",
      "x-ratelimit-limit": "5000",
      "x-ratelimit-remaining": "4988",
      "x-ratelimit-reset": "1579627793",
      "x-xss-protection": "1; mode=block"
    },
    data: issues
  };
};

beforeEach(() => {
  process.env.GITHUB_TOKEN = "token";
  let context = octomock.getContext();
  context.payload = {
    schedule: "*/5 * * * *"
  };
  octomock.updateContext(context);

  octomock.mockFunctions.listForRepo.mockReturnValue(buildIssueReturn(issues));

  octomock.mockFunctions.getInput
    .mockReturnValueOnce(login)
    .mockReturnValueOnce(name)
    .mockReturnValueOnce("<p>Email of Requester:\\s*(.*?)<\\/p>")
    .mockReturnValueOnce("direct_member");
});

describe("Main", () => {
  it("Loops through all of the issues and invites the users", async () => {
    await run();
    expect(octomock.mockFunctions.listForRepo).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.listForRepo).toHaveBeenCalledWith({
      owner: login,
      repo: name,
      labels: "new-user,retry"
    });

    expect(octomock.mockFunctions.createInvitation).toHaveBeenCalledTimes(
      issues.length
    );
    let i: number = 1;
    // sends invite for issues in order
    for (let issue of issues) {
      expect(octomock.mockFunctions.createInvitation).toHaveBeenNthCalledWith(
        i,
        {
          org: login,
          role: "direct_member",
          email: testEmail
        }
      );

      expect(octomock.mockFunctions.addLabels).toHaveBeenNthCalledWith(i, {
        owner: login,
        repo: name,
        issue_number: issue.number,
        labels: ["processed"]
      });

      expect(octomock.mockFunctions.update).toHaveBeenNthCalledWith(i, {
        owner: login,
        repo: name,
        issue_number: issue.number,
        state: "closed"
      });

      i++;
    }

    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledTimes(0);
  });

  it("Sets Failure without a valid token", async () => {
    delete process.env.GITHUB_TOKEN;
    await run();
    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledWith(
      "Token Not Provided"
    );
    expect(octomock.mockFunctions.listForRepo).toHaveBeenCalledTimes(0);

    process.env.GITHUB_TOKEN = "token";
  });

  it("Stops execution once the rate limit is hit, but does NOT mark the issue as failed", async () => {
    octomock.mockFunctions.createInvitation
      .mockReturnValueOnce(Promise.resolve("Success"))
      .mockReturnValueOnce(
        Promise.reject({
          name: "HttpError",
          status: 422,
          headers: {},
          request: {},
          errors: [
            {
              resource: "OrganizationInvitation",
              code: "unprocessable",
              field: "data",
              message: "Over invitation rate limit"
            }
          ],
          documentation_url:
            "https://developer.github.com/v3/orgs/members/#create-organization-invitation"
        })
      );
    await run();
    expect(octomock.mockFunctions.listForRepo).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.listForRepo).toHaveBeenCalledWith({
      owner: login,
      repo: name,
      labels: "new-user,retry"
    });

    expect(octomock.mockFunctions.createInvitation).toHaveBeenCalledTimes(2);
    expect(octomock.mockFunctions.addLabels).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledTimes(0);
  });

  it("Continues executing when there is a failure on one issue and marks that issue as failed", async () => {
    octomock.mockFunctions.createInvitation
      .mockReturnValueOnce(Promise.resolve("Success"))
      .mockReturnValueOnce(
        Promise.reject({
          name: "HttpError",
          status: 422,
          headers: {},
          request: {},
          errors: [
            {
              resource: "OrganizationInvitation",
              code: "unprocessable",
              field: "data",
              message: "Some Other Internal Error"
            }
          ],
          documentation_url:
            "https://developer.github.com/v3/orgs/members/#create-organization-invitation"
        })
      );
    await run();
    expect(octomock.mockFunctions.listForRepo).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.listForRepo).toHaveBeenCalledWith({
      owner: login,
      repo: name,
      labels: "new-user,retry"
    });

    expect(octomock.mockFunctions.createInvitation).toHaveBeenCalledTimes(
      issues.length
    );
    expect(octomock.mockFunctions.addLabels).toHaveBeenCalledTimes(
      issues.length
    );
    expect(octomock.mockFunctions.update).toHaveBeenCalledTimes(
      issues.length - 1
    ); // Test that we don't close the failed issue

    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledTimes(0);

    expect(octomock.mockFunctions.createInvitation).toHaveBeenNthCalledWith(2, {
      org: login,
      role: "direct_member",
      email: testEmail
    });

    expect(octomock.mockFunctions.addLabels).toHaveBeenNthCalledWith(2, {
      owner: login,
      repo: name,
      issue_number: issues[1].number,
      labels: ["automation-failed"]
    });
  });

  it("Takes only the first 500 issues", async () => {
    octomock.mockFunctions.listForRepo.mockReturnValue(
      buildIssueReturn(
        octomock.loadFixture("__tests__/fixtures/issues_511.json")
      )
    );
    await run();
    expect(octomock.mockFunctions.createInvitation).toHaveBeenCalledTimes(500);
  });
});

describe("getEmail", () => {
  it("Returns an email with a passed in regex", () => {
    let email = "email@github.com";
    let body: string = `I am an ${email}`;
    let regex: string = ".* (.*?@github.com)"; // Surely there has to be a simpler test regex I could use
    expect(getEmail(body, regex)).toEqual(email);
  });

  it("Returns an error when there is no match", () => {
    let email = "email@yahoo.com";
    let body: string = `I am an ${email}`;
    let regex: string = ".* (.*?@github.com)"; // Surely there has to be a simpler test regex I could use
    expect(() => {
      getEmail(body, regex);
    }).toThrowError("No valid email matches");
  });

  it("Returns an error when there is no matcher", () => {
    let email = "email@github.com";
    let body: string = `I am an ${email}`;
    let regex: string = ".* .*?@github.com"; // Surely there has to be a simpler test regex I could use
    expect(() => {
      getEmail(body, regex);
    }).toThrowError("No valid email matches");
  });
});
