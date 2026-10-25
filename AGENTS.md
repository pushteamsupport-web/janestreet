<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the imported site's TanStack routes and visual design as the app's structure; take package versions and Cloud clients from the target starter so the app never binds to stale platform settings.
- Keep authorization in database roles and ownership policies; never grant administrator access from user-editable metadata or an unverified email.
- Case submission caches the confirmed full database row before navigation and uploads proof separately, so slow or failed photos cannot hide a saved case or encourage duplicate filing.
- Signup verification uses the shared EmailVerification link notice, Cloud Auth resend with a same-origin /verified return URL, and getUser confirmation checks; hosted auth handles link validation and email delivery, while existing Authenticator MFA remains separate.
