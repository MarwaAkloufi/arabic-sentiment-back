import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('sentiment_logs')
export class SentimentLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'text', nullable: true })
  cleanedText: string;

  @Column({ type: 'varchar', length: 10 })
  label: string;

  @Column({ type: 'float' })
  confidence: number;

  @Column({ type: 'float', nullable: true })
  posProbability: number | null;

  @Column({ type: 'float', nullable: true })
  negProbability: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
