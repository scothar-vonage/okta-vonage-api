require("dotenv").config();

const { Auth } = require("@vonage/auth");
const { Messages, SMS } = require("@vonage/messages");

const express = require("express");

const app = express();

const credentials = new Auth({
  applicationId: process.env.VONAGE_APPLICATION_ID,
  privateKey: process.env.VONAGE_PRIVATE_KEY,
});

const brand = process.env.VERIFY_BRAND;

const options = {};

const client = new Messages(credentials, options);

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
    console.log("Unsupported channel: " + channel);
  }

  let res;
  try {
    res = await client.send(
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
