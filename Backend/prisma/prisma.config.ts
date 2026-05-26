const DATABASE_URL = process.env.DATABASE_URL;


if (!DATABASE_URL) {
  // Prisma CLI will load env from .env automatically, but this guard helps in case it isn't.
  // Throwing makes the issue obvious during local dev.
  throw new Error('Missing DATABASE_URL. Add it to stellarHerd-backend/.env (or configure your environment).');
}

const options = {
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
};

// PrismaService constructor can accept this config.

export default options;

  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
};

export default options;

