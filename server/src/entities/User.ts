import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToMany } from 'typeorm';
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
  ownedLists!: ChristmasList[];

  @ManyToMany(() => ChristmasList, list => list.sharedWith)
  sharedLists!: ChristmasList[];
}