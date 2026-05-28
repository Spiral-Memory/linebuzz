# **LineBuzz 🧵 Developer Collaboration in VS Code**

## **Overview 📘**

**LineBuzz** brings real-time collaboration directly into Visual Studio Code.
Stay in flow with your team using built-in huddles, team management, and persistent chat context—all without leaving your editor.

## **Features ✨**

* **Native Chat**: Real-time team panel directly inside VS Code.
* **GitHub Auth**: One-click login using your GitHub account.
* **Team Management**: Create, join, and switch teams easily.
* **Dev-First**: Markdown support with code syntax highlighting.
* **Theme Aware**: Automatically adapts to your VS Code theme (Light/Dark).
* **Secure Infrastructure**: Built on Supabase for reliable, secure real-time data synchronization.
* **Inline Code Discussions**: Comment directly on specific lines of code to keep context.
* **Smart Deep Linking**: Seamlessly navigate between chat messages and referenced code files.
* **Slack Integration **: Sync huddle messages, threads, and code attachments with interactive deep links (VS Code / GitHub) to/from your Slack workspace.

## **Development** 🛠️

LineBuzz uses **Preact** for its frontend and **Supabase** for backend services (auth, real-time sync), integrating directly with the VS Code API.

### **Installation ⚙️**

1. Clone the repository:

   ```bash
   git clone https://github.com/Spiral-Memory/LineBuzz.git
   ```
2. Open the project in **Visual Studio Code**:

   ```bash
   cd LineBuzz
   code .
   ```
3. Run `npm install` to install dependencies.

### **Configuration 🧰**

Create a `.env` file in the project root, based on `.env.example`, and populate it with your Supabase credentials:

```env
SUPABASE_URL=<your-supabase-url>
SUPABASE_ANON_KEY=<your-supabase-anon-key>
```
These values connect LineBuzz to your project’s backend for authentication and data sync.
Press **F5** to launch the extension in a new VS Code window (Extension Development Host).

That’s it -> LineBuzz will start running in the new window.

## **Usage 🔍**
1. **Connect**: Open the "LineBuzz" view and sign in with GitHub.
2. **Team Up**:
   - **Create a Team**: Use the `LineBuzz: Create Team` command or header action.
   - **Join a Team**: Enter a Team ID using `LineBuzz: Join Team`.
3. **Collaborate**: Open the **LineBuzz Huddle** sidebar to start chatting with your team in real-time.
4. **Code Sharing**: Paste code snippets directly into chat—LineBuzz handles formatting and highlighting automatically.
5. **Slack Synchronization**:
   - **Connect Workspace**: Click the **Sync Slack** icon in the LineBuzz Huddle panel title bar (only visible to team admins), authenticate, and choose the target channel.
   - **Sync Messages**: Use the Slack toggle checkbox inside the huddle chat input to selectively sync a message (including code segments and quotes) to Slack.
   - **Two-way Bridging**: Replies and messages sent within the linked Slack channel are automatically pushed back to your LineBuzz huddle.

## **Roadmap 🛣️**

* **Threads**: Create threads for replies and code discussions.
* **Mentions**: @mention team members and get notified.
* **Integrations**: Support bridging with additional external platforms.
* **AI Summaries**: Auto-generated summaries of catch-up conversations.


## **Contributing 🤝**

Contributions are always welcome.
Fork the repository, open it in VS Code, and use the built-in debugger to test your changes.

For significant updates, open an issue first to discuss your approach.