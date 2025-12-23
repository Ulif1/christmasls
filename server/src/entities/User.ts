import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ChristmasList } from './ChristmasList';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  username!: string;

  @Column()
  password!: string;

  @OneToMany(() => ChristmasList, list => list.user)
  lists!: ChristmasList[];
}