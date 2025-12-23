import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { User } from './User';
import { Item } from './Item';

@Entity()
export class ChristmasList {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @ManyToOne(() => User, user => user.ownedLists)
  user!: User;

  @ManyToMany(() => User, user => user.sharedLists)
  @JoinTable()
  sharedWith!: User[];

  @OneToMany(() => Item, item => item.list, { cascade: true })
  items!: Item[];
}