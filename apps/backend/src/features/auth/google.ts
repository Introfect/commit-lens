import { Google } from "arctic";
import { WithEnv } from "../../utils/commonTypes";

export function getGoogleOauthClient({ env }: WithEnv<{}>) {
  return new Google(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
}
