import app from './app';
import { env } from './config/env';

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`[server] Stellar Pad API running on port ${PORT}`);
});
