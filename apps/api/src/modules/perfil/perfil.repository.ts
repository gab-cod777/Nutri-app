import type { Prisma, PrismaClient, User, UserProfile } from '@prisma/client';

/** Unico ponto que toca `users` e `user_profiles`. */
export class PerfilRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findUser(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  findProfile(userId: string): Promise<UserProfile | null> {
    return this.prisma.userProfile.findUnique({ where: { userId } });
  }

  upsertProfile(
    db: Prisma.TransactionClient,
    userId: string,
    data: Omit<Prisma.UserProfileUncheckedCreateInput, 'userId'>,
  ): Promise<UserProfile> {
    return db.userProfile.upsert({
      where: { userId },
      create: { ...data, userId },
      update: data,
    });
  }

  updateProfile(
    db: Prisma.TransactionClient,
    userId: string,
    data: Prisma.UserProfileUncheckedUpdateInput,
  ): Promise<UserProfile> {
    return db.userProfile.update({ where: { userId }, data });
  }

  /** Remove o usuario e, por cascade, todos os dados dele. */
  async hardDelete(userId: string): Promise<void> {
    await this.prisma.user.deleteMany({ where: { id: userId } });
  }

  upsertWeightLog(db: Prisma.TransactionClient, userId: string, measuredOn: Date, weightKg: number) {
    return db.progressLog.upsert({
      where: { userId_metric_measuredOn: { userId, metric: 'weight_kg', measuredOn } },
      create: { userId, metric: 'weight_kg', measuredOn, value: weightKg },
      update: { value: weightKg },
    });
  }
}
