# chatterbox-alexa-skill
Amazon Alexa skill for Chatterbox Talking Newspaper

Chatterbox Norwich Talking Newspaper is a charity that provides audio publications for visually impaired and blind people. Our publications use items from local newspapers, magazines, and recorded interviews with local people.

The service is entirely free, and includes postage and loan equipment. Chatterbox is a registered charity, staffed by a 100% volunteer workforce, and funded through local fundraising and donations. Chatterbox also produces low-cost studio recordings for local authorities and commercial organisations.

To find out more or to contact Chatterbox, visit www.cbtn.org.uk

---

In order to run this code:

1. After downloading / cloning the repository, enter the `js` folder and run `npm install`.

2. Then, make a copy of the `appInfo.js.example` file, save it as `appInfo.js` and fill in the relevant details.
   
   Currently, all fields are mandatory. Database connection currently uses the Amazon RDS SSL certificate during connection. Please remove from the connection pool definition if not required.
