require("dotenv").config();

const { Auth } = require("@vonage/auth");
const { Messages, SMS } = require("@vonage/messages");
const {
  Voice,
  NCCOBuilder,
  Talk,
  OutboundCallWithNCCO,
} = require("@vonage/voice");

const express = require("express");

const app = express();

const credentials = new Auth({
  applicationId: process.env.VONAGE_APPLICATION_ID,
  privateKey: process.env.VONAGE_PRIVATE_KEY,
});

const brand = process.env.VERIFY_BRAND;

const options = {};

const smsClient = new Messages(credentials, options);
const voiceClient = new Voice(credentials, options);

app.use(express.json());

app.post("/verify", async (req, res) => {
  try {
    //console.log(req.body.data.messageProfile);
    const number = req.body.data.messageProfile.phoneNumber.replace(/\+/g, "");
    const code = req.body.data.messageProfile.otpCode;
    const channel = req.body.data.messageProfile.deliveryChannel;
    const ret = await sendVerificationRequest(number, code, channel);
    res.send(ret);
  } catch (e) {
    console.error(e);
    res.send(getErrorResponse("SMS", e));
  }
});

app.listen(process.env.PORT, () =>
  console.log(`Running on port ${process.env.PORT}`)
);

async function sendVerificationRequest(number, code, channel) {
  let params;
  if (channel.toLowerCase() == "sms") {
    console.log("Sending SMS to " + number);
  } else {
    console.log("Sending Call to " + number);
    const ret = await sendCall(number, code);
    return getSuccessResponse("verify", ret.uuid);
  }

  let res;
  try {
    res = await smsClient.send(
      new SMS({
        to: number,
        from: process.env.VERIFICATION_NUMBER,
        text: process.env.VERIFICATION_TEXT + code,
      })
    );

    console.log(res);
    return getSuccessResponse("verify", res.requestId);
  } catch (error) {
    console.log(res);
    throw error;
  }
}
async function sendCall(number, code) {
  const tts = `<speak>${
    process.env.VERIFICATION_TEXT
  } <prosody rate='x-slow'>${code
    .split("")
    .join(". ")}</prosody>. Again, that's: <prosody rate='x-slow'>${code
    .split("")
    .join(". ")}</prosody>. Good bye!</speak>`;

  const builder = new NCCOBuilder();
  builder.addAction(new Talk(tts));
  console.debug(`Sending tts: ${tts}`);

  let resp;

  try {
    resp = await voiceClient.createOutboundCall(
      new OutboundCallWithNCCO(
        builder.build(),
        { type: "phone", number: number },
        { type: "phone", number: process.env.VERIFICATION_NUMBER }
      )
    );
    console.debug(`Call uuid: ${resp.uuid}`);
  } catch (e) {
    console.log(e);
  }

  return resp;
}
function getSuccessResponse(method, sid) {
  console.log("Successfully sent " + method + " : " + sid);
  const actionKey = "com.okta.telephony.action";
  const actionVal = "SUCCESSFUL";
  const providerName = "VONAGE";
  const resp = {
    commands: [
      {
        type: actionKey,
        value: [
          {
            status: actionVal,
            provider: providerName,
            transactionId: sid,
          },
        ],
      },
    ],
  };
  return resp;
}

function getErrorResponse(method, error) {
  console.log("Error in " + method + " : " + error);
  const errorResp = {
    error: {
      errorSummary: error.response.data.title,
      errorCauses: [
        {
          errorSummary: error.code,
          reason: error.response.data.detail,
          location: error.detail,
        },
      ],
    },
  };
  return errorResp;
}
