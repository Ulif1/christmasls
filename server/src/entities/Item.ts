import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { ChristmasList } from './ChristmasList';

@Entity()
export class Item {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description!: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  price!: number;

  @ManyToOne(() => ChristmasList, list => list.items)
  list!: ChristmasList;
}