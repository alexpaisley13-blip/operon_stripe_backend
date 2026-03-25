import { jwt } from 'jsonwebtoken';
import { buildAuthorizationUrl } from 'stripe';

const testConnect = async (req, res) => {
  const testJwt = jwt.sign({ /* payload */ }, 'your-very-secret-key');
  const redirectUrl = buildAuthorizationUrl({
    response_type: 'code',
    client_id: 'your_client_id',
    scope: 'read_write',
  });

  res.redirect(redirectUrl + `?testJwt=${testJwt}`);
};

export default testConnect;