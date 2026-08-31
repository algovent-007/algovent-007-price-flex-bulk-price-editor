import { redirect } from "react-router";
import { appendEmbeddedAppParams } from "../../utils/embedded-app-params.server";

export const loader = async ({ request }) => {
  throw redirect(appendEmbeddedAppParams(request, "/app"));
};
