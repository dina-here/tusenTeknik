import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

/**
 * Demo-auth:
 * - Partner skickar x-api-key
 * - Vi slår upp partner i DB
 *
 * I produktion: OAuth2 + scopes + rate limiting + auditlogg.
 */
@Injectable()
export class PartnerApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const apiKey = req.headers["x-api-key"];

    if (!apiKey || typeof apiKey !== "string") {
      throw new UnauthorizedException("Missing x-api-key");
    }

    const partner = await this.prisma.partner.findUnique({ where: { apiKey } });
    if (!partner) {
      throw new ForbiddenException("Invalid api key");
    }

    req.partner = partner;
    return true;
  }
}
