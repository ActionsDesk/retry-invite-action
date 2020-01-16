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
beforeEach(() => {
  process.env.GITHUB_TOKEN = "token";
  let context = octomock.getContext();
  context.payload = {
    repository: {
      owner: {
        login: login
      },
      name: name
    },
    issue: {
      number: issueNumber
    }
  };
  octomock.updateContext(context);

  octomock.mockFunctions.listForRepo.mockReturnValue(issues);

  octomock.mockFunctions.getInput
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
      octomock.loadFixture("__tests__/fixtures/issues_511.json")
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
