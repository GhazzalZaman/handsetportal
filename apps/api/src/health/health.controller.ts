import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { Public } from '../common/public.decorator';
export class HealthResponseDto {
  @ApiProperty({ enum: ['ok'] })
  status = 'ok' as const;
}
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}
  @Get('live')
  @ApiOkResponse({ type: HealthResponseDto })
  live(): HealthResponseDto {
    return new HealthResponseDto();
  }
  @Get('ready')
  @ApiOkResponse({ type: HealthResponseDto })
  async ready(): Promise<HealthResponseDto> {
    await this.health.checkDatabase();
    return new HealthResponseDto();
  }
}
